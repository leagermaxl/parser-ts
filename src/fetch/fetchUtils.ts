import axios from 'axios';
import 'dotenv/config';

export const fetchData = async (url: string): Promise<string> => {
  let dataResponse = '';
  try {
    const { data } = await axios.get<string>(url, {
      headers: {
        Cookie: `mcsid=${process.env.MCSID}`,
      },
    });
    dataResponse = data;
  } catch (error) {
    console.error(error);
  }
  return dataResponse;
};
