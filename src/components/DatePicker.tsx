import { h } from 'preact'
import { useState } from 'preact/hooks'
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
  // Forces the dropdown shut right after a day is picked — the calendar's shadow DOM
  // makes a plain blur()-on-select unreliable, so this drives daisyui's .dropdown-close override.
  const [closed, setClosed] = useState(false)

  return (
    <div class={`dropdown ${closed ? 'dropdown-close' : ''}`}>
      <button
        id={id}
        type="button"
        class={`btn ${triggerClass}`}
        onClick={() => setClosed(false)}
      >
        {value ? formatDate(value) : placeholder}
        {placeholder && value && (
          <span
            role="button"
            aria-label="Clear date"
            class="ml-1 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
          >
            ✕
          </span>
        )}
      </button>
      <div tabIndex={0} class="dropdown-content z-10 bg-base-100 rounded-box shadow-lg p-2">
        <CalendarDate
          class="cally"
          value={value}
          onChange={(e: Event) => {
            onChange((e.target as HTMLInputElement).value)
            setClosed(true)
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
    </div>
  )
}
