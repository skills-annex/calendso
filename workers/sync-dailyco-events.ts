import Redis from 'ioredis';
import { Queue, Job, Worker } from 'bullmq';
import prisma from "@lib/prisma";

interface IDailyMeeting {
  id: string,
  room: string,
  start_time: string,
  duration: number,
  ongoing: boolean,
  createdAt : string
}

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const syncDailycoEvents = new Queue('SyncDailycoEvents', {
  connection,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 1000 },
});

new Worker(
  'SyncDailycoEvents',
  async (job: Job) => {
    const getAllMeetings = async () => {
      const meetings = [] as IDailyMeeting[];
      const getPartOfMeetings = (startFromId = '') => new Promise(resolve => {
        const endpoint = startFromId
          ? `https://api.daily.co/v1/meetings?starting_after=${startFromId}`
          : 'https://api.daily.co/v1/meetings'
        ;
        fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.DAILY_API_KEY}`
          }
        })
          .then(res => res.json())
          .then(({ data }) => {
            if (data?.length === 100) {
              meetings.push(...data);
              return getPartOfMeetings(data[data.length - 1].id)
            }
            if (data?.length > 0) {
              meetings.push(...data);
              resolve(meetings)
            } else {
              resolve(meetings);
            }
          })
          .finally(() => {
            resolve(meetings)
          })
      })
      return await getPartOfMeetings();
    }
    const meetings = await getAllMeetings() as IDailyMeeting[];

    for await (const meeting of meetings){
      const dbMeeting = await prisma.dailyMeetings.findUnique({
        where: {
          meetingId: meeting.id,
        },
        select: {
          ongoing: true
        }
      });
      const prismaDailyMeetingQuery = {
        meetingId: meeting.id,
        roomName: meeting.room,
        start_time: new Date(meeting.start_time).toISOString(),
        duration: meeting.duration,
        ongoing: meeting.ongoing,
        createdAt: new Date(Date.now()).toISOString(),
      }

      if (dbMeeting) {
        if (dbMeeting.ongoing && !meeting.ongoing){
          try {
            await prisma.dailyMeetings.update({
              where: {
                meetingId: meeting.id,
              },
              data: {
                ...prismaDailyMeetingQuery
              }
            });

            // TODO: Add ActiveCampaign integration to update:
            //  - "1on1 Completed Count" field:
            //      Using the roomName field, lookup the Booking and Attendees and then
            //      find the non-instructor Attendee's email,
            //      update the ActiveCampaign contact's field named "1on1 Completed Count",
            //      increment by 1 the current value.
            //  - "1on1 Last Completed At" field:
            //      Using the roomName field, lookup the Booking and Attendees and then
            //      find the non-instructor Attendee's email,
            //      update the ActiveCampaign contact's field named "1on1 Last Completed At",
            //      set the value as the start_time.


          } catch (e) {
            console.log({ e })
          }
        }
      } else {
        try {
          await prisma.dailyMeetings.create({
            data: {
              ...prismaDailyMeetingQuery
            }
          })
        } catch (e) {
          console.log({ e })
        }
      }
    }

  },
  { connection }
);

export default syncDailycoEvents;
