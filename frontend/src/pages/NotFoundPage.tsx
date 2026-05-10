import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl mb-4">🎯</p>
      <h1 className="text-3xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-gray-400 mb-8 max-w-sm">
        That URL doesn't exist. Try one of the links below.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          Home
        </Link>
        <Link
          to="/login"
          className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          Login
        </Link>
        <Link
          to="/v/southfield"
          className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
        >
          Demo venue
        </Link>
      </div>
    </div>
  )
}
