import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import type { OrdersWithTotal } from '../types.js';

const date = new Date();
const folderName = `${String(date.getDate()).padStart(2, '0')}-${String(
  date.getMonth() + 1,
).padStart(2, '0')}-${date.getFullYear()}`;

const folderPath = path.join(process.cwd(), folderName);

export async function createStyledExcel(couponCode: string, orders: OrdersWithTotal): Promise<void> {
  const SPECIAL_PRODUCT_NAME = 'Стейфолия Сыворотка для кожи головы и волос';

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
    console.log(`Папка создана: ${folderPath}`);
  } else {
    // console.log(`Папка уже существует: ${folderPath}`);
  }

  const filePath = path.join(folderPath, `${couponCode}.xlsx`);
  let workbook: ExcelJS.Workbook;
  // Если файл существует, загружаем его
  if (fs.existsSync(filePath)) {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
  } else {
    // Если файла нет, создаём новый
    workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Orders');
  }

  const worksheet = workbook.getWorksheet('Orders') || workbook.addWorksheet('Orders');

  // Если файл новый, создаём заголовки
  if (worksheet.rowCount === 0) {
    let headerRow;
    if (couponCode === 'all') {
      headerRow = worksheet.addRow([
        '№',
        '№ заказа',
        'id заказа',
        'Дата',
        'Сумма заказа',
        'Сумма выплаты',
        'Статус',
        'Наименование',
        'Количество',
        'Сумма',
      ]);
    } else if (couponCode === 'curlegina') {
      headerRow = worksheet.addRow([
        '№',
        '№ заказа',
        'Дата',
        'Сумма заказа',
        'Ставка',
        'Выплата',
        'Итого выплата',
        'Статус',
        'Наименование',
        'Количество',
        'Сумма',
      ]);
    } else {
      headerRow = worksheet.addRow([
        '№',
        '№ заказа',
        'Дата',
        'Сумма заказа',
        'Сумма выплаты 15%',
        'Статус',
        'Наименование',
        'Количество',
        'Сумма',
      ]);
    }
    // else if (couponCode === 'face10') {
    //   headerRow = worksheet.addRow([
    //     '№',
    //     '№ заказа',
    //     'Дата',
    //     'Сумма заказа',
    //     'Сумма выплаты 15%',
    //     'Статус',
    //     'Наименование',
    //     'Количество',
    //     'Сумма',
    //   ]);
    // } else {
    //   headerRow = worksheet.addRow([
    //     '№',
    //     '№ заказа',
    //     'Сумма заказа',
    //     'Сумма выплаты 15%',
    //     'Статус',
    //     'Сумма',
    //   ]);
    // }

    // Стили для заголовков
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Белый текст
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } }; // Синий фон
      cell.alignment = { horizontal: 'center' };
    });
  }

  let rowIndex = worksheet.rowCount + 1; // Начинаем с первой свободной строки

  //'№',
  //'№ заказа',
  //'id заказа',
  //'Дата',
  //'Сумма заказа',
  //'Сумма выплаты 15%',
  //'Статус',
  //'Наименование',
  //'Количество',
  orders.some((order, ind) => {
    const startRow = rowIndex;
    if (couponCode === 'all') {
      order.products.forEach((product, index) => {
        worksheet.addRow([
          index === 0 ? ind : null,
          index === 0 ? order.orderId : null,
          index === 0 ? order.orderNum : null,
          index === 0 ? order.orderDate : null,
          index === 0 ? order.amountWithCoupon : null,
          index === 0 ? order.amountPayment : null,
          index === 0 ? order.orderStatus.text : null,
          product.name,
          product.quantity,
          ind === 0 ? orders.amountEntire : null,
        ]);
        rowIndex++;
      });
      // Объединяем ячейки для заказной информации
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col) => {
        worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
        worksheet.getCell(`${col}${startRow}`).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });
      // else if (couponCode === 'face10') {}
    } else if (couponCode === 'curlegina') {
      order.products.forEach((product, index) => {
        // 1. Определяем ставку
        // Сравнение может быть строгим (===) или частичным (.includes)
        const isSpecial = product.name === SPECIAL_PRODUCT_NAME;
        const rateLabel = isSpecial ? '20%' : '15%';
        const rateMultiplier = isSpecial ? 0.2 : 0.15;

        // 2. Считаем комиссию за товар
        const productTotalPrice = product.totalPrice || 0;
        const itemCommission = (productTotalPrice * rateMultiplier * 0.9).toFixed(2);

        worksheet.addRow([
          index === 0 ? ind : null,
          index === 0 ? order.orderId : null,
          index === 0 ? order.orderDate : null,
          index === 0 ? order.amountWithCoupon : null,
          rateLabel,
          itemCommission,
          index === 0 ? order.amountPayment : null,
          index === 0 ? order.orderStatus.text : null,
          product.name,
          product.quantity,
          ind === 0 ? orders.amountEntire : null,
        ]);
        rowIndex++;
      });
      // Объединяем ячейки для заказной информации
      ['A', 'B', 'C', 'D', 'G', 'H'].forEach((col) => {
        worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
        worksheet.getCell(`${col}${startRow}`).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });
    } else {
      order.products.forEach((product, index) => {
        worksheet.addRow([
          index === 0 ? ind : null,
          index === 0 ? order.orderId : null,
          index === 0 ? order.orderDate : null,
          index === 0 ? order.amountWithCoupon : null,
          index === 0 ? order.amountPayment : null,
          index === 0 ? order.orderStatus.text : null,
          product.name,
          product.quantity,
          ind === 0 ? orders.amountEntire : null,
        ]);
        rowIndex++;
      });
      // Объединяем ячейки для заказной информации
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
        worksheet.mergeCells(`${col}${startRow}:${col}${rowIndex - 1}`);
        worksheet.getCell(`${col}${startRow}`).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });
    }
    // else {
    //   worksheet.addRow([
    //     ind,
    //     order.orderId,
    //     order.amountWithCoupon,
    //     order.amountPayment,
    //     order.orderStatus.text,
    //     ind === 0 ? orders['amountEntire'] : null,
    //   ]);
    //   rowIndex++;
    //   ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
    //     worksheet.getCell(`${col}${startRow}`).alignment = {
    //       vertical: 'middle',
    //       horizontal: 'center',
    //     };
    //   });
    // }

    // }

    // Устанавливаем границы и автоширину колонок
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell!({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString().length : 10;
        if (cellValue > maxLength) {
          maxLength = cellValue;
        }
      });
      column.width = maxLength + 2;
    });
    if (ind >= orders.length - 1) return true;
    return false;
  });

  // Сохранение файла
  await workbook.xlsx.writeFile(filePath);
  console.log(`Информация о заказах по промокоду ${couponCode} добавлена в ${filePath}!`);
}
