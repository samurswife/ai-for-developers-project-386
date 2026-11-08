import type { MeetingType } from '@calendar/api-sdk';

const dateLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  dateStyle: 'long',
});
const timeLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function BookingDetails({
  meetingType,
  startsAt,
  endsAt,
}: {
  meetingType: MeetingType;
  startsAt: string;
  endsAt: string;
}) {
  return (
    <div className="space-y-2 break-words">
      <p className="text-xl font-semibold">{meetingType.name}</p>
      <p>{dateLabel.format(new Date(startsAt))}</p>
      <p>
        {timeLabel.format(new Date(startsAt))} – {timeLabel.format(new Date(endsAt))}
      </p>
      <p>{meetingType.durationMinutes} мин</p>
      <p className="font-medium">Московское время (UTC+3)</p>
    </div>
  );
}
