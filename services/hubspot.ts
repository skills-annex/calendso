interface ISendEvent {
  data: {
    [property: string]: string | number;
  };
  email: string;
}

interface IGetContact {
  vid: number;
  "canonical-vid": number;
  "merged-vids": number[];
  "portal-id": number;
  "is-contact": boolean;
  "profile-url": string;
  properties: {
    [property: string]: {
      value: string;
    };
  };
}

const updateContact = async ({ data, email }: ISendEvent) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HUBSPOT_OAUTH_KEY}`,
    },
    body: JSON.stringify({
      properties: Object.entries(data).map(([key, value]) => ({ property: key, value })),
    }),
    json: true,
  };

  const response = await fetch(
    `https://api.hubapi.com/contacts/v1/contact/createOrUpdate/email/${email}`,
    options
  );
  const responseData = await response.json();
  return responseData;
};

export const getContact = async (email: string) => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HUBSPOT_OAUTH_KEY}`,
    },
  };

  const response = await fetch(`https://api.hubapi.com/contacts/v1/contact/email/${email}/profile`, options);
  const contact: IGetContact | null = await response.json();

  return contact;
};

export default updateContact;
