-- EUCLIDIAN M3 / Preparación de expedientes privados por usuario.
-- MIGRACIÓN NO APLICADA: activar solo tras revisión legal y prueba RLS de dos cuentas.
-- Separa los expedientes profesionales de control_interno_expedientes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.expedientes_profesionales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Investigación sin título' CHECK (char_length(titulo) BETWEEN 1 AND 140),
  pregunta text NOT NULL DEFAULT '' CHECK (char_length(pregunta) <= 1800),
  hechos text NOT NULL DEFAULT '' CHECK (char_length(hechos) <= 3000),
  hipotesis text NOT NULL DEFAULT '' CHECK (char_length(hipotesis) <= 3000),
  salvedades text NOT NULL DEFAULT '' CHECK (char_length(salvedades) <= 3000),
  conclusion text NOT NULL DEFAULT '' CHECK (char_length(conclusion) <= 3000),
  estado text NOT NULL DEFAULT 'borrador_sin_revision' CHECK (estado = 'borrador_sin_revision'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exp_prof_owner_fecha_idx
  ON public.expedientes_profesionales (owner_id, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS public.expediente_revisiones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expediente_id uuid NOT NULL REFERENCES public.expedientes_profesionales(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  creado_en timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('creacion','edicion')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  UNIQUE (expediente_id, version)
);

CREATE INDEX IF NOT EXISTS exp_revision_owner_expediente_idx
  ON public.expediente_revisiones (owner_id, expediente_id, version DESC);

CREATE OR REPLACE FUNCTION public.euclidian_exp_proteger_edicion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sesion_requerida';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'propietario_invalido';
    END IF;
    NEW.estado := 'borrador_sin_revision';
    NEW.version := 1;
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'identidad_expediente_inmutable';
    END IF;
    IF NEW.estado IS DISTINCT FROM 'borrador_sin_revision' THEN
      RAISE EXCEPTION 'revision_juridica_no_autorizada';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Esta función solo se ejecuta por TRIGGER y no es RPC.
-- La identidad la escribe el motor, no la envía el navegador.
CREATE OR REPLACE FUNCTION public.euclidian_exp_registrar_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.expediente_revisiones
    (expediente_id, owner_id, version, tipo, snapshot)
  VALUES
    (NEW.id, NEW.owner_id, NEW.version,
     CASE WHEN TG_OP = 'INSERT' THEN 'creacion' ELSE 'edicion' END,
     pg_catalog.jsonb_build_object(
       'titulo',NEW.titulo,'pregunta',NEW.pregunta,'hechos',NEW.hechos,
       'hipotesis',NEW.hipotesis,'salvedades',NEW.salvedades,
       'conclusion',NEW.conclusion,'estado','borrador_sin_revision'
     ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS euclidian_exp_proteger ON public.expedientes_profesionales;
CREATE TRIGGER euclidian_exp_proteger
  BEFORE INSERT OR UPDATE ON public.expedientes_profesionales
  FOR EACH ROW EXECUTE FUNCTION public.euclidian_exp_proteger_edicion();

DROP TRIGGER IF EXISTS euclidian_exp_historial ON public.expedientes_profesionales;
CREATE TRIGGER euclidian_exp_historial
  AFTER INSERT OR UPDATE ON public.expedientes_profesionales
  FOR EACH ROW EXECUTE FUNCTION public.euclidian_exp_registrar_revision();

ALTER TABLE public.expedientes_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedientes_profesionales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_revisiones FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.expedientes_profesionales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.expediente_revisiones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.euclidian_exp_proteger_edicion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.euclidian_exp_registrar_revision() FROM PUBLIC, anon, authenticated;

-- Solo se pueden introducir y cambiar notas; las columnas de identidad,
-- propietario, versión, marca temporal y estado no son editables por cliente.
GRANT SELECT, DELETE ON TABLE public.expedientes_profesionales TO authenticated;
GRANT INSERT (titulo, pregunta, hechos, hipotesis, salvedades, conclusion)
  ON TABLE public.expedientes_profesionales TO authenticated;
GRANT UPDATE (titulo, pregunta, hechos, hipotesis, salvedades, conclusion)
  ON TABLE public.expedientes_profesionales TO authenticated;
GRANT SELECT ON TABLE public.expediente_revisiones TO authenticated;

DROP POLICY IF EXISTS exp_propietario_select ON public.expedientes_profesionales;
CREATE POLICY exp_propietario_select ON public.expedientes_profesionales
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exp_propietario_insert ON public.expedientes_profesionales;
CREATE POLICY exp_propietario_insert ON public.expedientes_profesionales
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exp_propietario_update ON public.expedientes_profesionales;
CREATE POLICY exp_propietario_update ON public.expedientes_profesionales
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exp_propietario_delete ON public.expedientes_profesionales;
CREATE POLICY exp_propietario_delete ON public.expedientes_profesionales
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exp_rev_propietario_select ON public.expediente_revisiones;
CREATE POLICY exp_rev_propietario_select ON public.expediente_revisiones
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS
    (SELECT 1 FROM public.expedientes_profesionales e
     WHERE e.id = expediente_id AND e.owner_id = (SELECT auth.uid())));

COMMENT ON TABLE public.expedientes_profesionales IS
  'EUCLIDIAN M3: borradores privados. Sin afirmación de revisión jurídica.';
COMMENT ON TABLE public.expediente_revisiones IS
  'Historial privado inmutable para clientes; borrado en cascada al eliminar expediente o cuenta.';

COMMIT;
