import { useEditorState } from '@tiptap/react';
import { Bold, Italic, Underline, List, ListOrdered, Undo2, Redo2 } from 'lucide-react';

function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      // Keep the editor selection: do not let the button steal focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${
        active ? 'bg-zinc-200 text-zinc-900' : ''
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true" />;

export default function Toolbar({ editor, disabled }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'p',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setBlock = (value) => {
    const chain = editor.chain().focus();
    if (value === 'p') chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 shadow-sm"
    >
      <ToolButton label="Undo (Ctrl+Z)" disabled={disabled || !s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={disabled || !s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolButton>
      <Divider />
      <label className="sr-only" htmlFor="text-style">
        Text style
      </label>
      <select
        id="text-style"
        value={s.block}
        disabled={disabled}
        onChange={(e) => setBlock(e.target.value)}
        className="h-8 rounded-md border border-transparent bg-transparent px-2 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-40"
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <ToolButton label="Bold (Ctrl+B)" active={s.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={s.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Underline (Ctrl+U)" active={s.underline} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="h-4 w-4" />
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={s.bullet} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}
