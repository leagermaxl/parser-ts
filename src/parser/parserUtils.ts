import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { fetchData } from '../fetch/fetchUtils.js';
import type {
	Coupon,
	Order,
	OrderStatus,
	OrderTableRow,
	Product,
	ScrapedOrderRef,
} from '../types.js';

export const processFetchData = async (path: string, isLink: boolean): Promise<Order> => {
	let html: string;
	if (!isLink) html = await fs.readFile(path, 'utf-8');
	else html = await fetchData(path);

	// console.log('html', html);

	const dom = new JSDOM(html);
	const document = dom.window.document;

	const tables = document.querySelectorAll('.shop2-order-table');
	// console.log(tables);

	const OrderSelectedElement = document.querySelector('td.draggable_title span.title')!;
	const OrderNumber = OrderSelectedElement.textContent!;

	const orderStatus = getOrderStatus(document, '#order_status_style');

	const products = getProducts(document);

	const tableData: OrderTableRow[] = Array.from(tables).map((table, index) => {
		const rows = table.querySelectorAll('tr');
		const data: Record<string, string> = {};

		rows.forEach((row) => {
			const cells = row.querySelectorAll('td');
			if (cells.length === 2) {
				const key = cells[0]!.textContent!.trim();
				const value = cells[1]!.textContent!.trim();
				data[key] = value;
			}
		});

		return {
			tableIndex: index + 1,
			data,
			OrderNumber: OrderNumber,
			orderStatus,
			products,
		};
	});

	//console.log('Найденные таблицы:', tableData);

	const result = processOrderData(tableData);
	// console.log('Обработанный заказ:\n', result);
	return result;
};

function getOrderStatus(document: Document, selector: string): OrderStatus {
	const selectedField = document.querySelector<HTMLSelectElement>(selector)!;
	const selectedOption = selectedField.options[selectedField.selectedIndex]!;
	return {
		value: parseInt(selectedOption.value),
		text: selectedOption.textContent!.trim(),
	};
}

function getProducts(document: Document): Product[] {
	// 1. Ищем строки ТОЛЬКО внутри таблицы товаров (#order-products-table)
	// И берем только тело таблицы (tbody), чтобы исключить шапку
	const selector = '#order-products-table tbody tr:not(.view-hidden)';
	const rows = document.querySelectorAll(selector);

	const products = Array.from(rows)
		.filter((row) => {
			// Дополнительная проверка: строка должна иметь класс .product-name внутри
			// И должна иметь достаточное количество ячеек (минимум 11, судя по HTML)
			return row.querySelector('.product-name') && row.querySelectorAll('td').length > 5;
		})
		.map((row) => {
			const cells = row.querySelectorAll('td');

			// 1. Название и Артикул
			const nameElement = row.querySelector('.product-name');
			const articleElement = row.querySelector('.article');

			// 2. Картинка (ищем img внутри первой ячейки)
			const imgElement = row.querySelector<HTMLImageElement>('td img');
			const imgUrl = imgElement ? imgElement.src : null;

			// 3. Числовые значения
			// Важно: проверяем, существуют ли ячейки перед обращением к ним
			// Индексы из вашего HTML: [6]=Цена, [8]=Кол-во, [10]=Итого
			const priceText = cells[6] ? cells[6].textContent!.trim() : '0';
			const quantityText = cells[8] ? cells[8].textContent!.trim() : '0';
			const totalText = cells[10] ? cells[10].textContent!.trim() : '0';

			const cleanNumber = (str: string): number => {
				if (!str) return 0;
				// Удаляем все кроме цифр, точки и запятой
				const cleaned = str.replace(/[^0-9.,]/g, '').replace(',', '.');
				const num = parseFloat(cleaned);
				return isNaN(num) ? 0 : num;
			};

			return {
				name: nameElement ? nameElement.textContent!.trim() : 'Unknown',
				article: articleElement ? articleElement.textContent!.trim() : null,
				image: imgUrl,
				price: cleanNumber(priceText),
				quantity: cleanNumber(quantityText),
				totalPrice: cleanNumber(totalText),
			};
		});

	// Убираем дубликаты
	const uniqueProducts: Product[] = [];
	const seenNames = new Set<string>();

	products.forEach((product) => {
		if (!seenNames.has(product.name)) {
			uniqueProducts.push(product);
			seenNames.add(product.name);
		}
	});

	return uniqueProducts;
}

function getCoupon(data: Record<string, string>): Record<string, string> {
	const keys = Object.keys(data);
	const pattern = ['Сумма', 'Вес', 'Сумма со скидками', 'Доставка', 'Сумма к оплате'];

	const missingFields = keys
		.filter((key) => !pattern.includes(key))
		.reduce<Record<string, string>>((acc, key) => {
			acc[key] = data[key]!;
			return acc;
		}, {});

	return missingFields;
}

function parseCoupon(data: Record<string, string>): Coupon | null {
	// Список стандартных полей, которые НЕ являются купонами
	const standardFields = ['Сумма', 'Вес', 'Сумма со скидками', 'Доставка', 'Сумма к оплате'];

	// Ищем поле, которое не входит в стандартный список
	const couponEntry = Object.entries(data).find(([key, value]) => {
		// Проверяем, что это не стандартное поле
		if (standardFields.includes(key)) return false;

		// Дополнительная проверка: значение должно быть похоже на описание скидки
		// (содержать знак % или слово "Купон")
		if (value && (value.includes('%') || value.includes('Купон'))) return true;

		return false;
	});

	if (!couponEntry) return null;

	const [rawKey, rawValue] = couponEntry;

	// 1. Парсим процент скидки (ищем число перед знаком %)
	const percentMatch = rawValue.match(/(\d+)\s*%/);
	const discountPercent = percentMatch ? percentMatch[1] + '%' : null;

	// 2. Парсим код купона
	let code = '';

	// Сначала пробуем найти код внутри скобок: (Купон / CODE)
	const codeInBracketsMatch = rawValue.match(/\(Купон\s*\/\s*([^)]+)\)/);

	if (codeInBracketsMatch && codeInBracketsMatch[1]!.trim().length > 0) {
		// Если код есть внутри скобок - берем его
		code = codeInBracketsMatch[1]!.trim();
	} else {
		// Если в скобках пусто, значит код купона - это сам ключ (название поля в таблице)
		// Например, если ключ "curlegina", а значение "10 % (Купон / )"
		code = rawKey.trim();
	}

	// Защита: если ключ случайно оказался словом "Купон" или "Скидка", и кода нигде нет, оставляем null или пустую строку
	if (code.toLowerCase() === 'купон' || code.toLowerCase() === 'скидка') {
		if (code === rawKey) code = '';
	}

	code = code.toLocaleLowerCase();

	return {
		discountPercent,
		code,
	};
}

export function processOrderData(orderArray: OrderTableRow[]): Order {
	const couponField = parseCoupon(orderArray[3]!.data);

	const processedOrder: Order = Object.assign({
		orderId: 0,
		orderNum: 0,
		orderStatus: {} as OrderStatus,
		orderDate: null,
		totalAmount: '',
		amountWithCoupon: '',
		amountPayment: 0.0,
		products: [],
		coupon: null,
		// ERROR: null,
	});
	//  console.log(orderArray);
	orderArray.forEach((item) => {
		const { data, OrderNumber, products, orderStatus } = item;

		if (OrderNumber) {
			const sep = OrderNumber.match(/^Заказ #(\d+)\((\d+)\)$/)!;
			processedOrder.orderId = parseInt(sep[1]!);
			processedOrder.orderNum = parseInt(sep[2]!);
		}

		if (orderStatus) {
			processedOrder.orderStatus = orderStatus;
		}

		if (products) {
			processedOrder.products = products;
			//console.log(products);
			//console.log(couponField);
		}

		if (data['Дата заказа']) {
			processedOrder.orderDate = DateTime.fromFormat(
				data['Дата заказа'],
				'dd.MM.yy HH:mm',
			).toFormat('dd.MM.yyyy');
			//processedOrder.orderDate = DateTime.fromFormat(data['Дата заказа'], "dd.MM.yy HH:mm 'UTC'Z")
			//  .toUTC()
			//  .toJSDate();
		}

		if (data['Сумма']) {
			processedOrder.totalAmount = parseFloat(data['Сумма'].replace(/\s|руб\./g, ''));
		}

		if (data['Сумма со скидками']) {
			processedOrder.amountWithCoupon = parseFloat(
				data['Сумма со скидками'].replace(/\s|руб\./g, ''),
			);

			if (!couponField) {
				processedOrder.amountPayment =
					Math.round(processedOrder.amountWithCoupon * 0.15 * 100) / 100;
			} else {
				processedOrder.amountPayment = products.reduce((sum, product) => {
					if (
						couponField?.code.toLowerCase() === 'curlegina' &&
						product.name === 'Стейфолия Сыворотка для кожи головы и волос'
					) {
						sum +=
							Math.round(
								product.totalPrice *
									(1.0 - parseInt(couponField?.discountPercent as string) / 100) *
									0.2 *
									100,
							) / 100;
					} else {
						sum +=
							Math.round(
								product.totalPrice *
									(1.0 - parseInt(couponField?.discountPercent as string) / 100) *
									0.15 *
									100,
							) / 100;
					}
					return sum;
				}, 0);
			}

			//if (
			//  couponField.code.toLowerCase() === 'curlegina' &&
			//  products.includes((product) => product.name === 'Стейфолия масло для кожи головы и волос')
			//) {
			//  processedOrder.amountPayment =
			//    Math.round(processedOrder.amountWithCoupon * 0.2 * 100) / 100;
			//} else {
			//  processedOrder.amountPayment =
			//    Math.round(processedOrder.amountWithCoupon * 0.15 * 100) / 100;
			//}
		}

		if (couponField) {
			processedOrder.coupon = couponField;
		}
	});
	// console.log(processedOrder);
	return processedOrder;
}

export const processFetchOrders = async (
	path: string,
	isLink: boolean,
	lastOrderIdDB?: number,
): Promise<ScrapedOrderRef[] | null> => {
	let html: string;
	if (!isLink) html = await fs.readFile(path, 'utf-8');
	else html = await fetchData(path);

	const dom = new JSDOM(html);
	const document = dom.window.document;

	const orderIdsHTML = document.querySelectorAll('tr.order td.order-number span.objectAction');

	const orderIds: ScrapedOrderRef[] = [];
	const hasOrder = Array.from(orderIdsHTML).some((orderId) => {
		const order = orderId.textContent!.replace(/[()]/g, '').split(/\s+/);

		orderIds.push({ orderId: order[0]!, orderNum: order[1]! });
		if (parseInt(order[0]!) === lastOrderIdDB) return true;
		return false;
	});
	// console.log(hasOrder);
	// console.log(orderIds);
	return hasOrder ? orderIds : lastOrderIdDB ? null : orderIds;
};
