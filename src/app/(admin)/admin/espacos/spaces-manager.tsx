"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/lib/database.types";
import {
  deleteSection,
  deleteSpace,
  reorderSections,
  reorderSpaces,
  setSpaceArchived,
} from "./actions";
import { SectionDialog, SpaceDialog } from "./space-dialogs";

type Section = Tables<"sections">;
type Space = Tables<"spaces">;

const NO_SECTION = "__none__";

export function SpacesManager({
  sections,
  spaces,
}: {
  sections: Section[];
  spaces: Space[];
}) {
  const [, startTransition] = useTransition();
  const [sectionOrder, setSectionOrder] = useState(() =>
    sections.map((s) => s.id)
  );
  const [spacesBySection, setSpacesBySection] = useState(() =>
    groupSpaces(sections, spaces)
  );
  const [spaceDialog, setSpaceDialog] = useState<{
    open: boolean;
    space: Space | null;
  }>({ open: false, space: null });
  const [sectionDialog, setSectionDialog] = useState<{
    open: boolean;
    section: Section | null;
  }>({ open: false, section: null });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    const next = arrayMove(sectionOrder, oldIndex, newIndex);
    setSectionOrder(next);
    startTransition(() => reorderSections(next));
  }

  function handleSpaceDragEnd(sectionKey: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = spacesBySection.get(sectionKey) ?? [];
    const oldIndex = list.findIndex((s) => s.id === active.id);
    const newIndex = list.findIndex((s) => s.id === over.id);
    const next = arrayMove(list, oldIndex, newIndex);
    const updated = new Map(spacesBySection);
    updated.set(sectionKey, next);
    setSpacesBySection(updated);
    startTransition(() =>
      reorderSpaces(
        next.map((space, index) => ({
          id: space.id,
          sectionId: sectionKey === NO_SECTION ? null : sectionKey,
          position: index,
        }))
      )
    );
  }

  const sectionKeys = [
    ...sectionOrder,
    ...(spacesBySection.get(NO_SECTION)?.length ? [NO_SECTION] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setSpaceDialog({ open: true, space: null })}>
          <Plus className="size-4" /> Novo espaço
        </Button>
        <Button
          variant="outline"
          onClick={() => setSectionDialog({ open: true, section: null })}
        >
          <Plus className="size-4" /> Nova seção
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-4">
            {sectionKeys.map((key) => {
              const section =
                key === NO_SECTION ? null : sectionById.get(key) ?? null;
              return (
                <SectionCard
                  key={key}
                  sectionKey={key}
                  section={section}
                  spaces={spacesBySection.get(key) ?? []}
                  sortable={key !== NO_SECTION}
                  onEditSection={() =>
                    section && setSectionDialog({ open: true, section })
                  }
                  onDeleteSection={() => {
                    if (!section) return;
                    startTransition(async () => {
                      await deleteSection(section.id);
                      toast.success("Seção excluída. Os espaços foram mantidos.");
                    });
                  }}
                  onSpaceDragEnd={(e) => handleSpaceDragEnd(key, e)}
                  onEditSpace={(space) => setSpaceDialog({ open: true, space })}
                  onArchiveSpace={(space) =>
                    startTransition(async () => {
                      await setSpaceArchived(space.id, !space.archived_at);
                      toast.success(
                        space.archived_at
                          ? "Espaço restaurado."
                          : "Espaço arquivado. O conteúdo foi preservado."
                      );
                    })
                  }
                  onDeleteSpace={(space) =>
                    startTransition(async () => {
                      const result = await deleteSpace(space.id);
                      if (result.ok) toast.success("Espaço excluído.");
                      else toast.error(result.message);
                    })
                  }
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <SpaceDialog
        key={spaceDialog.space?.id ?? "new-space"}
        open={spaceDialog.open}
        space={spaceDialog.space}
        sections={sections}
        onOpenChange={(open) => setSpaceDialog((d) => ({ ...d, open }))}
      />
      <SectionDialog
        key={sectionDialog.section?.id ?? "new-section"}
        open={sectionDialog.open}
        section={sectionDialog.section}
        onOpenChange={(open) => setSectionDialog((d) => ({ ...d, open }))}
      />
    </div>
  );
}

function groupSpaces(sections: Section[], spaces: Space[]) {
  const map = new Map<string, Space[]>();
  for (const section of sections) map.set(section.id, []);
  map.set(NO_SECTION, []);
  for (const space of spaces) {
    const key = space.section_id ?? NO_SECTION;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(space);
  }
  return map;
}

function SectionCard({
  sectionKey,
  section,
  spaces,
  sortable,
  onEditSection,
  onDeleteSection,
  onSpaceDragEnd,
  onEditSpace,
  onArchiveSpace,
  onDeleteSpace,
}: {
  sectionKey: string;
  section: Section | null;
  spaces: Space[];
  sortable: boolean;
  onEditSection: () => void;
  onDeleteSection: () => void;
  onSpaceDragEnd: (event: DragEndEvent) => void;
  onEditSpace: (space: Space) => void;
  onArchiveSpace: (space: Space) => void;
  onDeleteSpace: (space: Space) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sectionKey, disabled: !sortable });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-xl border bg-card"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {sortable ? (
          <button
            className="cursor-grab touch-none text-muted-foreground"
            {...attributes}
            {...listeners}
            aria-label="Reordenar seção"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <p className="flex-1 text-sm font-semibold">
          {section?.name ?? "Sem seção"}
        </p>
        {section && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Ações da seção</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditSection}>
                <Pencil className="size-4" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDeleteSection}>
                <Trash2 className="size-4" /> Excluir seção
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {spaces.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Nenhum espaço nesta seção. Crie um espaço ou mova um existente para cá
          pelo formulário de edição.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onSpaceDragEnd}
        >
          <SortableContext
            items={spaces.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y">
              {spaces.map((space) => (
                <SpaceRow
                  key={space.id}
                  space={space}
                  onEdit={() => onEditSpace(space)}
                  onArchive={() => onArchiveSpace(space)}
                  onDelete={() => onDeleteSpace(space)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  feed: "Feed",
  library: "Biblioteca",
  events: "Eventos",
};

const VISIBILITY_LABELS: Record<string, string> = {
  all: "Visível",
  hidden: "Oculto",
  invite: "Por convite",
};

function SpaceRow({
  space,
  onEdit,
  onArchive,
  onDelete,
}: {
  space: Space;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: space.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 bg-card px-3 py-2.5"
    >
      <button
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reordenar espaço"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 text-center">{space.emoji ?? "•"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{space.name}</p>
        <p className="truncate text-xs text-muted-foreground">/{space.slug}</p>
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <Badge variant="outline">{TYPE_LABELS[space.type] ?? space.type}</Badge>
        {space.visibility !== "all" && (
          <Badge variant="secondary">
            {VISIBILITY_LABELS[space.visibility]}
          </Badge>
        )}
        {space.archived_at && <Badge variant="destructive">Arquivado</Badge>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Ações do espaço</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive}>
            {space.archived_at ? (
              <>
                <ArchiveRestore className="size-4" /> Restaurar
              </>
            ) : (
              <>
                <Archive className="size-4" /> Arquivar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
