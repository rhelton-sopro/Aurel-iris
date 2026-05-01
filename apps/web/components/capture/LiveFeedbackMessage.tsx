'use client'

interface LiveFeedbackMessageProps {
  message: string
}

export function LiveFeedbackMessage({ message }: LiveFeedbackMessageProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-full bg-black/60 backdrop-blur-sm px-6 py-3 text-base font-medium text-white text-center max-w-[80%]"
    >
      {message}
    </p>
  )
}
