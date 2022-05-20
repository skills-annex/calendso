import {
  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationIcon,
  LocationMarkerIcon,
} from "@heroicons/react/solid";
import { EventTypeCustomInputType } from "@prisma/client";
import dayjs from "dayjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, FocusEvent, useEffect, useMemo, useState } from "react";
import { useCookies } from "react-cookie";
import { Controller, useForm, useWatch } from "react-hook-form";
import reactHtmlParser from "react-html-parser";
import { FormattedNumber, IntlProvider } from "react-intl";
import { ReactMultiEmail } from "react-multi-email";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import { useMutation } from "react-query";
import { SingleValue } from "react-select";

import { createPaymentLink } from "@ee/lib/stripe/client";

import { asStringOrNull } from "@lib/asStringOrNull";
import { timeZone } from "@lib/clock";
import { ensureArray } from "@lib/ensureArray";
import { useLocale } from "@lib/hooks/useLocale";
import useTheme from "@lib/hooks/useTheme";
import { LocationType } from "@lib/location";
import createBooking from "@lib/mutations/bookings/create-booking";
import { parseZone } from "@lib/parseZone";
import slugify from "@lib/slugify";
import { collectPageParameters, telemetryEventTypes, useTelemetry } from "@lib/telemetry";

import CustomBranding from "@components/CustomBranding";
import { EmailInput, Form } from "@components/form/fields";
import AvatarGroup from "@components/ui/AvatarGroup";
import { Button } from "@components/ui/Button";
import PhoneInput from "@components/ui/form/PhoneInput";
import Select from "@components/ui/form/Select";

import { BookPageProps } from "../../../pages/[user]/book";
import { TeamBookingPageProps } from "../../../pages/team/[slug]/book";

type BookingPageProps = BookPageProps | TeamBookingPageProps;
type HeapIdentify = (email: string) => void;

const BookingPage = (props: BookingPageProps) => {
  const { t, i18n } = useLocale();
  const router = useRouter();
  /*
   * This was too optimistic
   * I started, then I remembered what a beast book/event.ts is
   * Gave up shortly after. One day. Maybe.
   *
  const mutation = trpc.useMutation("viewer.bookEvent", {
    onSuccess: ({ booking }) => {
      // go to success page.
    },
  });*/
  const [mobilePhone, setMobilePhone] = useState("");
  const [hasAuthorizedSms, setHasAuthorizedSms] = useState(true);
  const [, setCookie] = useCookies(["mobilePhone", "hasAuthorizedSms"]);

  const mutation = useMutation(createBooking, {
    onSuccess: async ({ attendees, paymentUid, ...responseData }) => {
      if (paymentUid) {
        return await router.push(
          createPaymentLink({
            paymentUid,
            date,
            name: attendees[0].name,
            absolute: false,
          })
        );
      }

      const location = (function humanReadableLocation(location) {
        if (!location) {
          return;
        }
        if (location.includes("integration")) {
          return t("web_conferencing_details_to_follow");
        }
        return location;
      })(responseData.location);

      return router.push({
        pathname: "/success",
        query: {
          date,
          type: props.eventType.id,
          user: props.profile.slug,
          reschedule: !!rescheduleUid,
          name: attendees[0].name,
          email: attendees[0].email,
          location,
        },
      });
    },
  });

  const rescheduleUid = router.query.rescheduleUid as string;
  const { isReady } = useTheme(props.profile.theme);

  const date = asStringOrNull(router.query.date);
  const timeFormat = asStringOrNull(router.query.clock) === "24h" ? "H:mm" : "h:mma";

  const [guestToggle, setGuestToggle] = useState(props.booking && props.booking.attendees.length > 1);
  const [hasBookedIntro, setHasBookedIntro] = useState(false);
  const [hasBirthYearError, setHasBirthYearError] = useState(false);
  const [mobilePhoneError, setMobilePhoneError] = useState("");

  type Location = { type: LocationType; address?: string };
  // it would be nice if Prisma at some point in the future allowed for Json<Location>; as of now this is not the case.
  const locations: Location[] = useMemo(
    () => (props.eventType.locations as Location[]) || [],
    [props.eventType.locations]
  );

  useEffect(() => {
    if (router.query.guest) {
      setGuestToggle(true);
    }
  }, [router.query.guest]);

  const telemetry = useTelemetry();
  useEffect(() => {
    telemetry.withJitsu((jitsu) => jitsu.track(telemetryEventTypes.timeSelected, collectPageParameters()));
  }, [telemetry]);

  const locationInfo = (type: LocationType) => locations.find((location) => location.type === type);

  // TODO: Move to translations
  const locationLabels = {
    [LocationType.InPerson]: t("in_person_meeting"),
    [LocationType.Phone]: t("phone_call"),
    [LocationType.GoogleMeet]: "Google Meet",
    [LocationType.Zoom]: "Zoom Video",
    [LocationType.Daily]: "Video Call",
  };

  type BookingFormValues = {
    birthYear: string;
    name: string;
    email: string;
    notes?: string;
    locationType?: LocationType;
    guests?: string[];
    phone?: string;
    customInputs?: {
      [key: string]: string;
    };
  };

  const defaultValues = () => {
    if (!rescheduleUid) {
      return {
        name: (router.query.name as string) || "",
        email: (router.query.email as string) || "",
        notes: (router.query.notes as string) || "",
        guests: ensureArray(router.query.guest) as string[],
        customInputs: props.eventType.customInputs.reduce(
          (customInputs, input) => ({
            ...customInputs,
            [input.id]: router.query[slugify(input.label)],
          }),
          {}
        ),
      };
    }
    if (!props.booking || !props.booking.attendees.length) {
      return {};
    }
    const primaryAttendee = props.booking.attendees[0];
    if (!primaryAttendee) {
      return {};
    }
    return {
      name: primaryAttendee.name || "",
      email: primaryAttendee.email || "",
      guests: props.booking.attendees.slice(1).map((attendee) => attendee.email),
    };
  };

  const birthYearOptions = Array.from(Array(new Date().getFullYear() - 1899).keys())
    .map((e) => e + 1900)
    .reverse()
    .map((fullYear) => {
      const year = fullYear.toString();
      return { label: year, value: year };
    });

  const isFree = !props.eventType?.price;

  const bookingForm = useForm<BookingFormValues>({
    defaultValues: defaultValues(),
    mode: "onTouched",
  });
  const errors = bookingForm.formState.errors;

  const selectedLocation = useWatch({
    control: bookingForm.control,
    name: "locationType",
    defaultValue: ((): LocationType | undefined => {
      if (router.query.location) {
        return router.query.location as LocationType;
      }
      if (locations.length === 1) {
        return locations[0]?.type;
      }
    })(),
  });

  const getLocationValue = (booking: Pick<BookingFormValues, "locationType" | "phone">) => {
    const { locationType } = booking;
    switch (locationType) {
      case LocationType.Phone: {
        return booking.phone || "";
      }
      case LocationType.InPerson: {
        return locationInfo(locationType)?.address || "";
      }
      // Catches all other location types, such as Google Meet, Zoom etc.
      default:
        return selectedLocation || "";
    }
  };

  const checkHasBookedIntro = async (email: string | undefined, eventTypeId: number | undefined) => {
    const isValidEmail = email?.match(/^\S+@\S+$/);

    if (email && isValidEmail && eventTypeId) {
      const introBookings = await fetch(
        `/api/bookings/intro-booking-by-attendee?email=${encodeURIComponent(
          email
        )}&eventTypeId=${eventTypeId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );
      const introBooking = await introBookings.json();
      return introBooking.length > 0;
    } else {
      return false;
    }
  };

  const handleEmailInputOnBlur = async (e: FocusEvent<HTMLInputElement, Element>) => {
    const bookedIntro = await checkHasBookedIntro(e?.target?.value, props?.eventType?.id);
    if (bookedIntro) {
      setHasBookedIntro(true);
    } else {
      setHasBookedIntro(false);
    }
    setMobilePhoneError("");
  };

  const handleMobilePhoneInputOnBlur = async (e: ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;

    if (phone) {
      if (isPossiblePhoneNumber(phone)) {
        setMobilePhone(`${phone.replace(/[-()\s+]/g, "")}`);
        setMobilePhoneError("");
      } else {
        setMobilePhoneError(t("invalid_mobile_phone"));
      }
    }
  };

  const handleBirthYearChange = async (
    e: SingleValue<{
      label: string;
      value: string;
    }>
  ) => {
    e?.value && bookingForm.setValue("birthYear", e.value);
    setHasBirthYearError(false);
  };

  const parseDate = (date: string | null) => {
    if (!date) return "No date";
    const parsedZone = parseZone(date);
    if (!parsedZone?.isValid()) return "Invalid date";
    const formattedTime = parsedZone?.format(timeFormat);
    return formattedTime + ", " + dayjs(date).toDate().toLocaleString(i18n.language, { dateStyle: "full" });
  };

  const bookEvent = async (booking: BookingFormValues) => {
    if (typeof window !== "undefined" && window.heap) {
      (window.heap.identify as HeapIdentify)(booking.email);
      window.heap.track("Submit Calendar Booking Form", {
        instructorName: props.profile.name,
        eventTypeTitle: props.eventType.title,
        eventTypeLength: props.eventType.length,
        attendeeName: booking.name,
        attendeeEmail: booking.email,
      });
    }

    telemetry.withJitsu((jitsu) =>
      jitsu.track(telemetryEventTypes.bookingConfirmed, collectPageParameters())
    );

    // "metadata" is a reserved key to allow for connecting external users without relying on the email address.
    // <...url>&metadata[user_id]=123 will be send as a custom input field as the hidden type.
    const metadata = Object.keys(router.query)
      .filter((key) => key.startsWith("metadata"))
      .reduce(
        (metadata, key) => ({
          ...metadata,
          [key.substring("metadata[".length, key.length - 1)]: router.query[key],
        }),
        {}
      );

    mutation.mutate({
      ...booking,
      start: dayjs(date).format(),
      end: dayjs(date).add(props.eventType.length, "minute").format(),
      eventTypeId: props.eventType.id,
      timeZone: timeZone(),
      language: i18n.language,
      rescheduleUid,
      user: router.query.user,
      location: getLocationValue(booking.locationType ? booking : { locationType: selectedLocation }) || "",
      metadata,
      customInputs: Object.keys(booking.customInputs || {}).map((inputId) => ({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        label: props.eventType.customInputs.find((input) => input.id === parseInt(inputId))!.label,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value: booking.customInputs![inputId],
      })),
    });
  };

  const ErrorBlock = ({ message }: { message: string }) => (
    <div className="p-4 mt-2 border-l-4 border-yellow-400 bg-yellow-50">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationIcon className="w-5 h-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">{reactHtmlParser(message)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Head>
        <title>
          {rescheduleUid
            ? t("booking_reschedule_confirmation", {
                eventTypeTitle: props.eventType.title,
                profileName: props.profile.name,
              })
            : t("booking_confirmation", {
                eventTypeTitle: props.eventType.title,
                profileName: props.profile.name,
              })}{" "}
          | The Skills
        </title>
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>
      {"brandColor" in props.profile && <CustomBranding val={props.profile.brandColor} />}
      <main className="max-w-3xl mx-auto my-0 rounded-sm sm:my-24 sm:border sm:dark:border-gray-600">
        {isReady && (
          <div className="overflow-hidden bg-white border border-gray-200 dark:bg-neutral-900 dark:border-0 sm:rounded-sm">
            <div className="px-4 py-5 sm:flex sm:p-4">
              <div className="sm:w-1/2 sm:border-r sm:dark:border-gray-800">
                {props.profile?.image && props.profile?.name && (
                  <AvatarGroup
                    size={14}
                    items={[{ image: props.profile.image, alt: props.profile.name }].concat(
                      props.eventType.users
                        .filter((user) => user.name !== props.profile.name)
                        .map((user) => ({
                          alt: user.name || "",
                          image: user.avatar || "",
                          title: user.name,
                        }))
                    )}
                  />
                )}
                <h2 className="mt-2 font-medium text-gray-500 font-cal dark:text-gray-300">
                  {props.profile.name}
                </h2>
                <h1 className="mb-4 text-3xl font-semibold text-gray-800 dark:text-white">
                  {props.eventType.title}
                </h1>
                <p className="mb-2 text-gray-500">
                  <ClockIcon className="inline-block w-4 h-4 mr-1 -mt-1" />
                  {props.eventType.length} {t("minutes")}
                </p>

                <p className="px-2 py-1 mb-1 -ml-2 text-gray-500">
                  <CreditCardIcon className="inline-block w-4 h-4 mr-1 -mt-1" />
                  {isFree ? (
                    "Free"
                  ) : (
                    <IntlProvider locale="en">
                      <FormattedNumber
                        value={props.eventType.price / 100.0}
                        style="currency"
                        currency={props.eventType.currency.toUpperCase()}
                      />
                    </IntlProvider>
                  )}
                </p>

                {selectedLocation === LocationType.InPerson && (
                  <p className="mb-2 text-gray-500">
                    <LocationMarkerIcon className="inline-block w-4 h-4 mr-1 -mt-1" />
                    {getLocationValue({ locationType: selectedLocation })}
                  </p>
                )}
                <p className="mb-4 text-green-500">
                  <CalendarIcon className="inline-block w-4 h-4 mr-1 -mt-1" />
                  {parseDate(date)}
                </p>
                <p className="mb-8 text-gray-600 dark:text-white">{props.eventType.description}</p>
              </div>
              <div className="sm:w-1/2 sm:pl-8 sm:pr-4">
                <Form
                  form={bookingForm}
                  handleSubmit={async (booking, e) => {
                    e?.preventDefault();

                    const bookedIntro = await checkHasBookedIntro(booking?.email, props?.eventType?.id);
                    if (bookedIntro) {
                      setHasBookedIntro(true);
                    } else {
                      setHasBookedIntro(false);

                      if (isFree) {
                        if (!booking?.birthYear) {
                          setHasBirthYearError(true);
                          return true;
                        }
                        setHasBirthYearError(false);

                        await fetch("/api/hs-proxy", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            email: booking.email,
                            properties: {
                              birth_year: booking.birthYear,
                              email: booking.email,
                              firstname: booking.name.split(" ")[0],
                              lastname: booking.name.split(" ").slice(1).join(" "),
                              mobilephone: hasAuthorizedSms ? mobilePhone : undefined,
                              n1on1_instructor_last_purchased: props.eventType.users[0].name || "",
                              n1on1_instructor_last_purchased_image_url:
                                props.eventType.users[0].avatar || "",
                            },
                          }),
                        });

                        const isThirteenOrYounger = dayjs().year() - Number(booking.birthYear) <= 13;
                        if (isThirteenOrYounger) {
                          router.push({
                            pathname: "/success",
                            query: {
                              date,
                              type: props.eventType.id,
                              user: "",
                              reschedule: false,
                              name: "",
                              email: "",
                              location: "",
                            },
                          });
                          return true;
                        }

                        await fetch("/api/integrations/thetis/create-user", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            attendees: [{ email: booking.email, hasAuthorizedSms, mobilePhone, name }],
                          }),
                        });
                      }

                      mobilePhone &&
                        setCookie("mobilePhone", mobilePhone, {
                          expires: dayjs().add(1, "hour").toDate(),
                        });
                      hasAuthorizedSms &&
                        setCookie("hasAuthorizedSms", hasAuthorizedSms, {
                          expires: dayjs().add(1, "hour").toDate(),
                        });
                      bookEvent(booking);
                      return true;
                    }
                  }}>
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-white">
                      {t("your_name")}
                    </label>
                    <div className="mt-1">
                      <input
                        {...bookingForm.register("name")}
                        type="text"
                        name="name"
                        id="name"
                        required
                        className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 dark:text-white">
                      {t("email_address")}
                    </label>
                    <div className="mt-1">
                      <EmailInput
                        {...bookingForm.register("email")}
                        required
                        className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                        placeholder="you@example.com"
                        onBlur={(e) => handleEmailInputOnBlur(e)}
                      />
                    </div>
                  </div>
                  {isFree && (
                    <div className="mb-4">
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-white">
                        Birth Year
                      </label>
                      <div className="mt-1">
                        <Select
                          {...bookingForm.register("birthYear")}
                          defaultValue={{ label: "", value: "" }}
                          onChange={(e) => handleBirthYearChange(e)}
                          options={birthYearOptions}
                        />
                      </div>
                      {hasBirthYearError && <ErrorBlock message={t("error_required_field")} />}
                    </div>
                  )}
                  {locations.length > 1 && (
                    <div className="mb-4">
                      <span className="block text-sm font-medium text-gray-700 dark:text-white">
                        {t("location")}
                      </span>
                      {locations.map((location, i) => (
                        <label key={i} className="block">
                          <input
                            type="radio"
                            className="w-4 h-4 mr-2 text-black border-gray-300 location focus:ring-black"
                            {...bookingForm.register("locationType", { required: true })}
                            value={location.type}
                            defaultChecked={selectedLocation === location.type}
                          />
                          <span className="ml-2 text-sm dark:text-gray-500">
                            {locationLabels[location.type]}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mb-4">
                    <label
                      htmlFor="mobilePhone"
                      className="block text-sm font-medium text-gray-700 dark:text-white">
                      {t("phone_number")}
                    </label>
                    <div className="mt-1">
                      <PhoneInput
                        name="mobilePhone"
                        international={true}
                        defaultCountry="US"
                        placeholder={"+1 888 888 8888"}
                        id="mobilePhone"
                        onBlur={(e: ChangeEvent<HTMLInputElement>) => handleMobilePhoneInputOnBlur(e)}
                      />
                    </div>
                  </div>
                  <div className="flex mb-4 mt-5">
                    <label
                      htmlFor="hasAuthorizedSms"
                      className="flex mb-1 text-sm font-medium text-gray-700 dark:text-white">
                      <input
                        type="checkbox"
                        id="hasAuthorizedSms"
                        className="w-4 h-4 mr-2 mt-1 text-black border-gray-300 rounded focus:ring-black"
                        defaultChecked={hasAuthorizedSms}
                        onChange={(e) => setHasAuthorizedSms(e.currentTarget.checked)}
                      />
                      <p>{reactHtmlParser(t("automated_event_reminder"))}</p>
                    </label>
                  </div>
                  {props.eventType.customInputs
                    .sort((a, b) => a.id - b.id)
                    .map((input) => (
                      <div className="mb-4" key={input.id}>
                        {input.type !== EventTypeCustomInputType.BOOL && (
                          <label
                            htmlFor={"custom_" + input.id}
                            className="block mb-1 text-sm font-medium text-gray-700 dark:text-white">
                            {input.label}
                          </label>
                        )}
                        {input.type === EventTypeCustomInputType.TEXTLONG && (
                          <textarea
                            {...bookingForm.register(`customInputs.${input.id}`, {
                              required: input.required,
                            })}
                            id={"custom_" + input.id}
                            rows={3}
                            className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                            placeholder={input.placeholder}
                          />
                        )}
                        {input.type === EventTypeCustomInputType.TEXT && (
                          <input
                            type="text"
                            {...bookingForm.register(`customInputs.${input.id}`, {
                              required: input.required,
                            })}
                            id={"custom_" + input.id}
                            className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                            placeholder={input.placeholder}
                          />
                        )}
                        {input.type === EventTypeCustomInputType.NUMBER && (
                          <input
                            type="number"
                            {...bookingForm.register(`customInputs.${input.id}`, {
                              required: input.required,
                            })}
                            id={"custom_" + input.id}
                            className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                            placeholder=""
                          />
                        )}
                        {input.type === EventTypeCustomInputType.BOOL && (
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              {...bookingForm.register(`customInputs.${input.id}`, {
                                required: input.required,
                              })}
                              id={"custom_" + input.id}
                              className="w-4 h-4 mr-2 text-black border-gray-300 rounded focus:ring-black"
                              placeholder=""
                            />
                            <label
                              htmlFor={"custom_" + input.id}
                              className="block mb-1 text-sm font-medium text-gray-700 dark:text-white">
                              {input.label}
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  {!props.eventType.disableGuests && (
                    <div className="mb-4">
                      {!guestToggle && (
                        <label
                          onClick={() => setGuestToggle(!guestToggle)}
                          htmlFor="guests"
                          className="block mb-1 text-sm font-medium dark:text-white hover:cursor-pointer">
                          {/*<UserAddIcon className="inline-block w-5 h-5 mr-1 -mt-1" />*/}
                          {t("additional_guests")}
                        </label>
                      )}
                      {guestToggle && (
                        <div>
                          <label
                            htmlFor="guests"
                            className="block mb-1 text-sm font-medium text-gray-700 dark:text-white">
                            {t("guests")}
                          </label>
                          <Controller
                            control={bookingForm.control}
                            name="guests"
                            render={({ field: { onChange, value } }) => (
                              <ReactMultiEmail
                                className="relative"
                                placeholder="guest@example.com"
                                emails={value}
                                onChange={onChange}
                                getLabel={(
                                  email: string,
                                  index: number,
                                  removeEmail: (index: number) => void
                                ) => {
                                  return (
                                    <div data-tag key={index}>
                                      {email}
                                      <span data-tag-handle onClick={() => removeEmail(index)}>
                                        ×
                                      </span>
                                    </div>
                                  );
                                }}
                              />
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mb-4">
                    <label
                      htmlFor="notes"
                      className="block mb-1 text-sm font-medium text-gray-700 dark:text-white">
                      {t("additional_notes_session")}
                    </label>
                    <textarea
                      {...bookingForm.register("notes", {
                        minLength: {
                          value: 4,
                          message: t("additional_notes_session_error"),
                        },
                      })}
                      id="notes"
                      required
                      rows={3}
                      className="block w-full border-gray-300 rounded-sm shadow-sm dark:bg-black dark:text-white dark:border-gray-900 focus:ring-black focus:border-brand sm:text-sm"
                      placeholder={t("share_additional_notes")}
                    />
                    {errors.notes && (
                      <div
                        className="text-sm bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-3"
                        role="alert">
                        <strong className="block font-bold">{t("oops_error")}</strong>
                        <div className="block sm:inline">{errors.notes.message}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start space-x-2">
                    <Button
                      type="submit"
                      disabled={hasBookedIntro || !!mobilePhoneError}
                      loading={mutation.isLoading}>
                      {rescheduleUid ? t("reschedule") : t("confirm")}
                    </Button>
                    <Button color="secondary" type="button" onClick={() => router.back()}>
                      {t("cancel")}
                    </Button>
                  </div>
                </Form>
                {mutation.isError && (
                  <ErrorBlock message={rescheduleUid ? t("reschedule_fail") : t("booking_fail")} />
                )}
                {hasBookedIntro && (
                  <ErrorBlock
                    message={t("intro_already_booked", {
                      instructorName: props.profile.name,
                      slug: props.profile.slug,
                    })}
                  />
                )}
                {mobilePhoneError && <ErrorBlock message={mobilePhoneError} />}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookingPage;
