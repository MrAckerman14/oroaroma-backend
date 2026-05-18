// utils/dateRange.js
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Santo_Domingo'

export const getDateRange = (from, to) => {
  const start = dayjs.tz(from, TZ).startOf('day').utc().toDate()
  const end   = dayjs.tz(to,   TZ).endOf('day').utc().toDate()
  return { start, end }
}