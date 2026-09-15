import { h } from 'preact'
import { useRef } from 'preact/hooks'
import 'cally'
import { formatDate } from '../lib/formatDate'

// Thin wrappers so JSX can use the cally custom elements without a global JSX.IntrinsicElements augmentation.
const CalendarDate = (props: any) => h('calendar-date', props)
const CalendarMonth = (props: any) => h('calendar-month', props)

interface Props {
  id: string
  value: string // 'YYYY-MM-DD', or '' when clearable and unset
  onChange: (value: string) => void
  triggerClass?: string
  /** Shown instead of a formatted date when value is '' — omit for required fields. */
  placeholder?: string
}

export function DatePicker({ id, value, onChange, triggerClass = '', placeholder }: Props) {
  // ponytail: <details> instead of daisyui's focus-within dropdown — WebKit (macOS Safari /
  // Tauri WKWebView) doesn't focus <button> on click, so a focus-driven dropdown never opens there.
  const details = useRef<HTMLDetailsElement>(null)

  return (
    <details class="dropdown" ref={details}>
      <summary id={id} aria-labelledby={`${id}-label`} class={`btn ${triggerClass}`}>
        {value ? formatDate(value) : placeholder}
        {placeholder && value && (
          <span
            role="button"
            aria-label="Clear date"
            class="ml-1 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onChange('')
            }}
          >
            ✕
          </span>
        )}
      </summary>
      <div class="dropdown-content z-10 bg-base-100 rounded-box shadow-lg p-2">
        <CalendarDate
          class="cally"
          value={value}
          onChange={(e: Event) => {
            onChange((e.target as HTMLInputElement).value)
            if (details.current) details.current.open = false
          }}
        >
          <svg aria-label="Previous" class="size-4" slot="previous" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15.75 19.5 8.25 12l7.5-7.5" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <svg aria-label="Next" class="size-4" slot="next" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m8.25 4.5 7.5 7.5-7.5 7.5" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <CalendarMonth />
        </CalendarDate>
      </div>
    </details>
  )
}
