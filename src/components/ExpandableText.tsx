import { useState } from 'preact/hooks'

// Click to toggle between clamped and full text.
export function ExpandableText({ text, clampClass, class: className = '' }: {
  text: string
  clampClass: string
  class?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <p
      class={`cursor-pointer ${expanded ? '' : clampClass} ${className}`}
      onClick={() => setExpanded((e) => !e)}
    >
      {text}
    </p>
  )
}
