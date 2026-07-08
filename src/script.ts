import type { OrdersWithTotal } from './types.js';
import {
	filteringOrdersInProgress,
	groupingOrdersByCoupon,
	readArrayFromJson,
	requestsForOrders,
	requestsForOrdersByArray,
	writeArrayInJson,
} from './utils/utils.js';
import { createStyledExcel } from './utils/xlsx.js';
import 'dotenv/config';

const urlPage = process.env.URL_PAGE || '';
const urlOrder = process.env.URL_ORDER || '';

export const pathFileConfig = 'config.json';

export const runScraper = async (): Promise<void> => {
	const orders: OrdersWithTotal = [];

	const dataFromConfig = (await readArrayFromJson(pathFileConfig))!;
	dataFromConfig.ordersInProgress.sort((a, b) => a.orderId - b.orderId);
	// console.log(dataFromConfig.ordersInProgress);

	if (dataFromConfig.ordersInProgress.length > 0) {
		const ordersByArray = await requestsForOrdersByArray(
			urlPage,
			urlOrder,
			dataFromConfig.ordersInProgress,
		);
		orders.push(...ordersByArray);
	}
	orders.sort((a, b) => a.orderId - b.orderId);

	const ordersFromLastOrderId = await requestsForOrders(
		urlPage,
		urlOrder,
		dataFromConfig.lastOrderId,
	);
	orders.push(...ordersFromLastOrderId);
	orders.amountEntire = orders
		.filter((order) => order.orderStatus.value === 3)
		.reduce((acc, order) => acc + order.amountPayment, 0);
	console.log(orders);
	await createStyledExcel('all', orders);

	const inProgressOrders = await filteringOrdersInProgress(orders);

	const groupedOrders = await groupingOrdersByCoupon(orders);

	for (const couponCode of Object.keys(groupedOrders)) {
		const group = groupedOrders[couponCode]! as OrdersWithTotal;
		group.amountEntire = group
			.filter((order) => order.orderStatus.value === 3)
			.reduce((acc, order) => acc + order.amountPayment, 0);

		await createStyledExcel(couponCode, group);
	}

	await writeArrayInJson(pathFileConfig, {
		lastOrderId: orders[orders.length - 1]!.orderId + 1,
		ordersInProgress: inProgressOrders.reverse(),
	});
};
