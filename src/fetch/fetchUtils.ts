import axios from 'axios';
import 'dotenv/config';

export class SessionExpiredError extends Error {
	constructor() {
		super('Токен устарел, обновите его.');
		this.name = 'SessionExpiredError';
	}
}

const isLoginPage = (html: string): boolean => html.includes('id="login_form"');

export const fetchData = async (url: string): Promise<string> => {
	const { data } = await axios.get<string>(url, {
		headers: {
			Cookie: `mcsid=${process.env.MCSID}`,
		},
	});
	if (isLoginPage(data)) throw new SessionExpiredError();
	return data;
};
