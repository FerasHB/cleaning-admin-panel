"use client"

// components/jobs/EmployeeMultiSelect.tsx
// Mehrfachauswahl der zugewiesenen Mitarbeiter — Web-Pendant zu Mobiles
// EmployeeMultiSelector. Inaktive Einträge (nur beim Bearbeiten, wenn sie dem
// Auftrag bereits zugewiesen sind) werden als ausgewählt + gesperrt gezeigt;
// sie können weder an- noch abgewählt werden.

import { cn } from "@/lib/utils"
import type { EmployeeOption } from "@/lib/jobs/jobs.service"

type Props = {
  employees: EmployeeOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  emptyLabel?: string
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  disabled = false,
  emptyLabel = "Keine aktiven Mitarbeiter verfügbar.",
}: Props) {
  // Nach id deduplizieren (aktive + bereits zugewiesene inaktive können sich
  // überschneiden).
  const unique = Array.from(new Map(employees.map((e) => [e.id, e])).values())

  if (unique.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    )
  }

  return (
    <div className="space-y-2">
      <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-input">
        {unique.map((emp) => {
          const isInactive = !emp.isActive
          const checked = isInactive || selectedIds.includes(emp.id)
          const rowDisabled = disabled || isInactive
          return (
            <label
              key={emp.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm",
                rowDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-50",
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={checked}
                disabled={rowDisabled}
                onChange={() => toggle(emp.id)}
              />
              <span className="min-w-0 flex-1 truncate">{emp.fullName}</span>
              {isInactive && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Inaktiv
                </span>
              )}
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedIds.length === 0
          ? "Niemand ausgewählt — der Auftrag bleibt unzugewiesen."
          : `${selectedIds.length} ausgewählt`}
      </p>
    </div>
  )
}
