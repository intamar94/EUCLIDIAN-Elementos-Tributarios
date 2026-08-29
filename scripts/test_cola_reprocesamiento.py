from cola_reprocesamiento import WorkItem, route, isolate


def test_review_returns_to_reprocess_without_blocking():
    item = route(WorkItem("A"), approved=False, correctable=True, error="fecha")
    assert item.estado == "CORRECTING"
    assert item.siguiente_accion == "REPROCESS"
    assert item.iteracion == 1


def test_approved_finishes():
    item = route(WorkItem("A"), approved=True, correctable=False)
    assert item.estado == "APPROVED"


def test_persistent_case_escalates_only_itself():
    items = isolate([WorkItem("A"), WorkItem("B")])
    assert [x.documento_id for x in items] == ["A", "B"]

    a = route(items[0], approved=False, correctable=True)
    for _ in range(10):
        a = route(a, approved=False, correctable=True, error="persistente")
    b = route(items[1], approved=True, correctable=False)
    assert a.estado == "ESCALATED"
    assert b.estado == "APPROVED"
