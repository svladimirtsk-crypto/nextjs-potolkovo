type SubmitLeadPayload = {
  name: string;
  phone: string;
  message?: string;
};

export async function submitLeadToProvider(payload: SubmitLeadPayload) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;

  if (!accessKey) {
    throw new Error("WEB3FORMS_ACCESS_KEY is not configured.");
  }

  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      access_key: accessKey,
      subject: "Новая заявка с сайта ПОТОЛКОВО",
      from_name: "ПОТОЛКОВО Сайт",
      name: payload.name,
      phone: payload.phone,
      message: payload.message ?? "Заявка с главной страницы",
      botcheck: "",
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error("Lead provider request failed.");
  }

  return result;
}
