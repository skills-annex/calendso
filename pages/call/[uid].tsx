import DailyIframe from "@daily-co/daily-js";
import { NextPageContext } from "next";
import { getSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";

import prisma from "@lib/prisma";
import { inferSSRProps } from "@lib/types/inferSSRProps";

import { HeadSeo } from "@components/seo/head-seo";

export type JoinCallPageProps = inferSSRProps<typeof getServerSideProps>;

export default function JoinCall(props: JoinCallPageProps) {
  const session = props.session;
  const router = useRouter();

  //if no booking redirectis to the 404 page
  const emptyBooking = props.booking === null;

  //daily.co calls have a 60 minute exit and entry buffer when a user enters a call when it's not available it will trigger the modals
  const now = new Date();
  const enterDate = new Date(now.getTime() + 60 * 60 * 1000);
  const exitDate = new Date(now.getTime() - 60 * 60 * 1000);

  console.log(enterDate);

  //find out if the meeting is upcoming or in the past
  const isPast = new Date(props.booking?.endTime || "") <= exitDate;
  const isUpcoming = new Date(props.booking?.startTime || "") >= enterDate;
  const meetingUnavailable = isUpcoming == true || isPast == true;

  const [hasJoinedCall, setHasJoinedCall] = useState(false);
  const dailyIframeParent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (emptyBooking) {
      router.push("/call/no-meeting-found");
    }

    if (isUpcoming) {
      router.push(`/call/meeting-not-started/${props.booking?.uid}`);
    }

    if (isPast) {
      router.push(`/call/meeting-ended/${props.booking?.uid}`);
    }
  });

  useEffect(() => {
    if (
      !meetingUnavailable &&
      !emptyBooking &&
      session?.userid !== props.booking.user?.id &&
      dailyIframeParent?.current
    ) {
      const callFrame = DailyIframe.createFrame(dailyIframeParent.current, {
        iframeStyle: {
          position: "absolute",
          width: "100%",
          height: "100%",
        },
        showLeaveButton: true,
        theme: {
          colors: {
            accent: "#6664C8",
            accentText: "#FFF",
            background: "#111111",
            backgroundAccent: "#111111",
            baseText: "#FFF",
            border: "#292929",
            mainAreaBg: "#111111",
            mainAreaBgAccent: "#111111",
            mainAreaText: "#FFF",
            supportiveText: "#FFF",
          },
        },
      });
      callFrame
        .join({
          url: props.booking.dailyRef?.dailyurl,
          showLeaveButton: true,
        })
        .then(() => {
          setHasJoinedCall(true);
          if (props.record) {
            callFrame.startRecording({
              width: 1280,
              height: 720,
              backgroundColor: "#FF1F2D3D",
              layout: {
                preset: "default",
                max_cam_streams: 5,
              },
            });
          }
        });
    }
    if (
      !meetingUnavailable &&
      !emptyBooking &&
      session?.userid === props.booking.user?.id &&
      dailyIframeParent?.current
    ) {
      const callFrame = DailyIframe.createFrame(dailyIframeParent.current, {
        iframeStyle: {
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "none",
        },
        showLeaveButton: true,
        theme: {
          colors: {
            accent: "#6664C8",
            accentText: "#FFF",
            background: "#111111",
            backgroundAccent: "#111111",
            baseText: "#FFF",
            border: "#292929",
            mainAreaBg: "#111111",
            mainAreaBgAccent: "#111111",
            mainAreaText: "#FFF",
            supportiveText: "#FFF",
          },
        },
      });
      callFrame
        .join({
          url: props.booking.dailyRef?.dailyurl,
          showLeaveButton: true,
          token: props.booking.dailyRef?.dailytoken,
        })
        .then(() => {
          setHasJoinedCall(true);
          if (props.record) {
            callFrame.startRecording({
              width: 1280,
              height: 720,
              backgroundColor: "#FF1F2D3D",
              layout: {
                preset: "default",
                max_cam_streams: 5,
              },
            });
          }
        });
    }
  }, []);

  return (
    <>
      <HeadSeo title="Video Conference" description="Join the video call" />
      <Head>
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://cal.com/video-og-image.png" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:image" content="https://cal.com/video-og-image.png" />
      </Head>
      <div
        style={{
          alignItems: "center",
          background: "#111111",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: "100vh",
          position: "relative",
          zIndex: 2,
        }}>
        <Link href="/">
          <img
            className="fixed z-10 hidden w-auto h-10 sm:inline-block"
            src="/the-skills-logo-black.svg"
            alt="The Skills Logo"
            style={{
              top: 46,
              left: 24,
            }}
          />
        </Link>
        <div
          ref={dailyIframeParent}
          style={{
            position: "relative",
            ...(hasJoinedCall
              ? {
                  height: "100vh",
                  width: "100vw",
                }
              : {
                  flex: 1,
                  width: "100%",
                }),
          }}
        />
        {!hasJoinedCall && (
          <div>
            <p style={{ color: "white", padding: "24px", textAlign: "center" }}>
              Having issues with your Audio or Video? <br /> Visit our{" "}
              <a
                href={`${process.env.THETIS_SITE_HOST}/video-call-troubleshooting`}
                rel="noreferrer"
                style={{
                  color: "#6664C8",
                }}
                target="_blank"
                title="video call troubleshooting">
                troubleshooting page
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const record = context.query.record || false;
  const booking = await prisma.booking.findUnique({
    where: {
      uid: context.query.uid as string,
    },
    select: {
      uid: true,
      id: true,
      title: true,
      description: true,
      startTime: true,
      endTime: true,
      user: {
        select: {
          id: true,
          credentials: true,
        },
      },
      attendees: true,
      dailyRef: {
        select: {
          dailyurl: true,
          dailytoken: true,
        },
      },
      references: {
        select: {
          uid: true,
          type: true,
        },
      },
    },
  });

  if (!booking) {
    // TODO: Booking is already cancelled
    return {
      props: { booking: null },
    };
  }

  const bookingObj = Object.assign({}, booking, {
    startTime: booking.startTime.toString(),
    endTime: booking.endTime.toString(),
  });
  const session = await getSession();

  return {
    props: {
      record,
      booking: bookingObj,
      session: session,
    },
  };
}
