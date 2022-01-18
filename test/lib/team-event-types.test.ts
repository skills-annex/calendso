import { getLuckyUsers } from "../../pages/api/book/event";

it("can find lucky users", async () => {
  const users = [
    {
      id: 1,
      username: "test",
      name: "Test User",
      credentials: [],
      timeZone: "GMT",
      bufferTime: 0,
      email: "test@example.com",
      thetisId: null,
      destinationCalendar: null,
    },
    {
      id: 2,
      username: "test2",
      name: "Test 2 User",
      credentials: [],
      timeZone: "GMT",
      bufferTime: 0,
      email: "test2@example.com",
      thetisId: null,
      destinationCalendar: null,
    },
  ];
  expect(
    getLuckyUsers(users, [
      { username: "test", bookingCount: 2 },
      { username: "test2", bookingCount: 0 },
    ])
  ).toStrictEqual([users[1]]);
});
