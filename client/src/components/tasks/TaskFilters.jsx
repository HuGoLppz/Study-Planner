import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useState } from "react";
import { useSubjects } from "../../hooks/useSubjects.js";
import { useIsMobile } from "../../hooks/useUi.js";
import { PRIORITIES, TASK_TYPES } from "../../utils/tasks.js";
import { Button } from "../ui/Button.jsx";
import { Field, Input, Select } from "../ui/Form.jsx";
import { Modal, OverlayFooter } from "../ui/Overlay.jsx";

function FilterSelects({ values, onChange }) {
  const { subjects } = useSubjects();
  return (
    <>
      <Field label="Asignatura" hideLabel>
        <Select
          value={values.subject}
          onChange={(event) => onChange("subject", event.target.value)}
          aria-label="Asignatura"
        >
          <option value="">Todas las asignaturas</option>
          <option value="none">Sin asignatura</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tipo" hideLabel>
        <Select
          value={values.type}
          onChange={(event) => onChange("type", event.target.value)}
          aria-label="Tipo de actividad"
        >
          <option value="">Todos los tipos</option>
          {TASK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Urgencia" hideLabel>
        <Select
          value={values.priority}
          onChange={(event) => onChange("priority", event.target.value)}
          aria-label="Urgencia"
        >
          <option value="">Cualquier urgencia</option>
          {PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              Urgencia {priority.label.toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

// Búsqueda + filtros. En móvil los filtros viven en una hoja inferior.
export function TaskFilters({ values, onChange, onClear, activeCount }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <div className="task-filters-bar">
      <Field label="Buscar tareas" hideLabel className="task-filters-search">
        <Input
          type="search"
          icon={MagnifyingGlass}
          placeholder="Buscar por título o descripción"
          value={values.q}
          onChange={(event) => onChange("q", event.target.value)}
        />
      </Field>

      {isMobile ? (
        <>
          <Button
            variant="secondary"
            icon={Funnel}
            onClick={() => setOpen(true)}
          >
            Filtros{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <Modal open={open} onOpenChange={setOpen} title="Filtrar tareas">
            <div className="task-filters-sheet">
              <FilterSelects values={values} onChange={onChange} />
            </div>
            <OverlayFooter>
              <Button
                variant="secondary"
                onClick={onClear}
                disabled={!activeCount}
              >
                Quitar filtros
              </Button>
              <Button onClick={() => setOpen(false)}>Ver resultados</Button>
            </OverlayFooter>
          </Modal>
        </>
      ) : (
        <>
          <FilterSelects values={values} onChange={onChange} />
          {activeCount ? (
            <Button variant="ghost" icon={X} onClick={onClear}>
              Quitar filtros
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
