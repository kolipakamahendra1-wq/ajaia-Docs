import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-medium text-zinc-500">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Page not found</h1>
        <p className="mt-2 text-sm text-zinc-600">The page you are looking for does not exist.</p>
        <Link
          to="/app/documents"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Go to my documents
        </Link>
      </div>
    </div>
  );
}
