import { format, parseISO, isValid } from 'date-fns';
import { id } from 'date-fns/locale';

export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return startDate || endDate || '-';
  
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (!isValid(start) || !isValid(end)) {
      return `${startDate} - ${endDate}`;
    }

    const startDay = format(start, 'dd', { locale: id });
    const endDay = format(end, 'dd', { locale: id });
    const startMonth = format(start, 'MMM', { locale: id });
    const endMonth = format(end, 'MMM', { locale: id });
    const startYear = format(start, 'yyyy', { locale: id });
    const endYear = format(end, 'yyyy', { locale: id });

    if (startYear === endYear) {
      if (startMonth === endMonth) {
        if (startDay === endDay) {
          return `${startDay} ${startMonth} ${startYear}`;
        }
        return `${startDay} - ${endDay} ${startMonth} ${startYear}`;
      }
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
    }
    
    return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
  } catch (e) {
    console.error('Date parsing error:', e);
    return `${startDate} - ${endDate}`;
  }
}

export function formatSingleDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'dd MMM yyyy', { locale: id });
  } catch (e) {
    return dateStr;
  }
}
