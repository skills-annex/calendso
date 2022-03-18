import { BanIcon, CheckIcon, XIcon, MailIcon } from "@heroicons/react/outline";
import { BookingStatus } from "@prisma/client";
import dayjs from "dayjs";
import { useState } from "react";
import { useMutation } from "react-query";

import { HttpError } from "@lib/core/http/error";
import { useLocale } from "@lib/hooks/useLocale";
import {
  TWELVE_HOUR_TIME_FORMAT,
  TWELVE_HOUR_TIME_FORMAT_2,
} from "@lib/integrations/calendar/constants/formats";
import { inferQueryOutput, trpc } from "@lib/trpc";

import TableActions, { ActionType } from "@components/ui/TableActions";

type BookingItem = inferQueryOutput<"viewer.bookings">["bookings"][number];

const formatTimeRange = (startTime: string, endTime: string) => {
  const end = dayjs(endTime);
  const start = dayjs(startTime);
  const isSameTimeOfDay = start.format("a") === end.format("a");

  if (isSameTimeOfDay) {
    return `${start.format(TWELVE_HOUR_TIME_FORMAT_2)} - ${end.format(TWELVE_HOUR_TIME_FORMAT)}`;
  } else {
    return `${start.format(TWELVE_HOUR_TIME_FORMAT)} - ${end.format(TWELVE_HOUR_TIME_FORMAT)}`;
  }
};

function BookingListItem(booking: BookingItem) {
  const { t, i18n } = useLocale();
  const utils = trpc.useContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const mutation = useMutation(
    async (confirm: boolean) => {
      const res = await fetch("/api/book/confirm", {
        method: "PATCH",
        body: JSON.stringify({ id: booking.id, confirmed: confirm, language: i18n.language }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        throw new HttpError({ statusCode: res.status });
      }
    },
    {
      async onSettled() {
        await utils.invalidateQueries(["viewer.bookings"]);
      },
    }
  );
  const isUpcoming = new Date(booking.endTime) >= new Date();
  const isCancelled = booking.status === BookingStatus.CANCELLED;

  const handleResendEmails = async (bookingUid: string) => {
    if (confirm("Send event reminder email to all attendees?") == true) {
      setIsProcessing(true);

      const payload = {
        uid: bookingUid,
      };

      const res = await fetch("/api/email/resend", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setIsProcessing(false);

      const json = await res.json();

      if (res.status >= 200 && res.status < 300) {
        alert(json?.message || "Success");
      } else {
        alert(json?.message || "Error: Email reminders failed to send.");
      }
    }
  };

  const pendingActions: ActionType[] = [
    {
      id: "reject",
      label: t("reject"),
      onClick: () => mutation.mutate(false),
      icon: BanIcon,
      disabled: mutation.isLoading,
    },
    {
      id: "confirm",
      label: t("confirm"),
      onClick: () => mutation.mutate(true),
      icon: CheckIcon,
      disabled: mutation.isLoading,
      color: "primary",
    },
  ];

  const bookedActions: ActionType[] = [
    {
      id: "cancel",
      label: t("cancel"),
      href: `/cancel/${booking.uid}`,
      icon: XIcon,
    },
    {
      id: "email_reminder",
      label: t("email_reminder"),
      onClick: () => handleResendEmails(booking.uid),
      disabled: isProcessing,
      icon: MailIcon,
    },
  ];

  const startTime = dayjs(booking.startTime).format(isUpcoming ? "ddd, D MMM" : "D MMMM YYYY");
  const timeRange = formatTimeRange(booking.startTime, booking.endTime);

  return (
    <tr className="flex">
      <td className="hidden py-4 pl-6 align-top sm:table-cell whitespace-nowrap">
        <div className="text-sm leading-6 text-gray-900">{startTime}</div>
        <div className="text-sm text-gray-500">{timeRange}</div>
      </td>
      <td className={"pl-4 py-4 flex-1" + (booking.rejected ? " line-through" : "")}>
        <div className="sm:hidden">
          {!booking.confirmed && !booking.rejected && <Tag className="mb-2 mr-2">{t("unconfirmed")}</Tag>}
          {!!booking?.eventType?.price && !booking.paid && <Tag className="mb-2 mr-2">Pending payment</Tag>}
          <div className="text-sm font-medium text-gray-900">
            {startTime}: <small className="text-sm text-gray-500">{timeRange}</small>
          </div>
        </div>
        <div
          title={booking.title}
          className="text-sm font-medium leading-6 truncate text-neutral-900 max-w-56 md:max-w-max">
          {booking.eventType?.team && <strong>{booking.eventType.team.name}: </strong>}
          {booking.title}
          {!!booking?.eventType?.price && !booking.paid && (
            <Tag className="hidden ml-2 sm:inline-flex">Pending payment</Tag>
          )}
          {!booking.confirmed && !booking.rejected && (
            <Tag className="hidden ml-2 sm:inline-flex">{t("unconfirmed")}</Tag>
          )}
        </div>
        {booking.description && (
          <div className="text-sm text-gray-500 truncate max-w-52 md:max-w-96" title={booking.description}>
            &quot;{booking.description}&quot;
          </div>
        )}
      </td>

      <td className="py-4 pr-4 text-sm font-medium text-right whitespace-nowrap">
        {isUpcoming && !isCancelled ? (
          <>
            {!booking.confirmed && !booking.rejected && <TableActions actions={pendingActions} />}
            {booking.confirmed && !booking.rejected && <TableActions actions={bookedActions} />}
            {!booking.confirmed && booking.rejected && (
              <div className="text-sm text-gray-500">{t("rejected")}</div>
            )}
          </>
        ) : null}
      </td>
    </tr>
  );
}

const Tag = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-yellow-100 text-yellow-800 ${className}`}>
      {children}
    </span>
  );
};

export default BookingListItem;
