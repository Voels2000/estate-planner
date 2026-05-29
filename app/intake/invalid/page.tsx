import Link from 'next/link'

export default function IntakeInvalidPage() {
  return (
    <div className="min-h-screen bg-[#0F1B3C] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center">
        <h1 className="text-xl font-semibold text-[#0F1B3C]">This link is invalid</h1>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          The intake invitation could not be found. Ask your attorney to send a new invitation.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-[#0F1B3C] underline underline-offset-2"
        >
          Go to homepage →
        </Link>
      </div>
    </div>
  )
}
