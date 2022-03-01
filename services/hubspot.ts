interface ISendEvent {
  data: {
    [property: string]: string;
  };
  email: string;
}

const updateContact = async ({ data, email }: ISendEvent) => {
  const options = {
    method: "POST",
    qs: { hapikey: process.env.HUBSPOT_API_KEY },
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: Object.entries(data).map(([key, value]) => ({ property: key, value })),
    }),
    json: true,
  };

  const response = await fetch(
    `https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/${email}/?hapikey=${process.env.HUBSPOT_API_KEY}`,
    options
  );
  const responseData = await response.json();
  return responseData;
};

export default updateContact;
