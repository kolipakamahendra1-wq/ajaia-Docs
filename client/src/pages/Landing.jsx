import { Link, Navigate } from 'react-router-dom';
import { FileUp, History, PenLine, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/ui.jsx';

const FEATURES = [
  {
    icon: PenLine,
    title: 'Rich-text editing',
    text: 'Headings, bold, italic, underline and lists, with undo and redo. Formatting is stored and restored exactly.',
  },
  {
    icon: History,
    title: 'Autosave you can trust',
    text: 'Changes save automatically a moment after you stop typing. The save status is always visible.',
  },
  {
    icon: FileUp,
    title: 'Import your files',
    text: 'Upload a .txt, .md or .docx file and it becomes a new, fully editable document.',
  },
  {
    icon: Users,
    title: 'Share with permissions',
    text: 'Invite registered users as viewers or editors and revoke access whenever you like.',
  },
  {
    icon: ShieldCheck,
    title: 'Enforced on the server',
    text: 'Every read and write is checked by the API. The interface cannot grant more access than the server allows.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app/documents" replace />;

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-6">
          <a href="#features" className="hidden text-sm text-zinc-600 hover:text-zinc-900 sm:inline">
            Features
          </a>
          <Link
            to="/login"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-24">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
            Write, share and keep your documents in one place
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600">
            Ajaia Docs is a lightweight document editor. Create a document, import an existing file, and share it with
            teammates as a viewer or an editor.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Open the app
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              See what it does
            </a>
          </div>
        </section>

        <section id="features" className="border-t border-zinc-100 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">What you can do</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border border-zinc-200 bg-white p-5">
                  <Icon className="h-5 w-5 text-zinc-700" aria-hidden="true" />
                  <h3 className="mt-3 text-base font-semibold text-zinc-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100 px-4 py-6 text-center text-sm text-zinc-500">
        Ajaia Docs · Built for the Ajaia LLC AI-Native Full Stack Developer assignment
      </footer>
    </div>
  );
}
