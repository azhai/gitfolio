import React from 'react'
import ReactDatePicker from 'react-datepicker'
import { zhCN, enUS } from 'date-fns/locale'
import { getLanguage } from '../i18n'
import 'react-datepicker/dist/react-datepicker.css'
import './datepicker.css'

var LOCALE_MAP = { zh: zhCN, en: enUS }

var ZH_DAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

function formatWeekDay(name) {
  var lang = getLanguage()
  if (lang === 'zh') {
    var idx = ZH_DAY_SHORT.indexOf(name.replace('星期', '').replace('周', ''))
    if (idx >= 0) return ZH_DAY_SHORT[idx]
    var last = name.charAt(name.length - 1)
    if (ZH_DAY_SHORT.indexOf(last) >= 0) return last
  }
  return name.slice(0, 2)
}

function DateTimePicker(props) {
  var lang = getLanguage()
  var locale = LOCALE_MAP[lang] || enUS
  var value = props.value
  var onChange = props.onChange
  var placeholder = props.placeholder
  var minDate = props.minDate

  var selected = value ? new Date(value) : null

  function handleChange(date) {
    if (onChange) {
      if (date) {
        var offset = date.getTimezoneOffset()
        var local = new Date(date.getTime() - offset * 60000)
        onChange(local.toISOString().slice(0, 16))
      } else {
        onChange('')
      }
    }
  }

  return (
    <ReactDatePicker
      selected={selected}
      onChange={handleChange}
      showTimeSelect
      timeFormat="HH:mm"
      timeIntervals={15}
      dateFormat={lang === 'zh' ? 'yyyy-MM-dd HH:mm' : 'MMM d, yyyy h:mm aa'}
      locale={locale}
      placeholderText={placeholder}
      minDate={minDate}
      className="gitfolio-datepicker"
      calendarClassName="gitfolio-calendar"
      popperClassName="gitfolio-popper"
      formatWeekDay={formatWeekDay}
      isClearable
    />
  )
}

export default DateTimePicker
