const ROLE_LABELS = {
  admin: 'Admin',
  employee: 'Vendedor',
  supervisor: 'Supervisor',
  collaborator: 'Colaborador',
  messenger: 'Mensajero'
}

const ROLE_KEYS = {
  Admin: 'admin',
  Administrador: 'admin',
  Vendedor: 'employee',
  Supervisor: 'supervisor',
  Colaborador: 'collaborator',
  Mensajero: 'messenger',
  Empleado: 'employee'
}

const LEGACY_ROLE_KEYS = {
  seller: 'collaborator'
}

function canonicalRoleKey(value) {
  const key = String(value || '').trim().toLowerCase()
  return LEGACY_ROLE_KEYS[key] || key
}

const STATUS_TO_LABEL = {
  DELIVERY_PENDING: 'Pendiente',
  FINALIZED: 'Finalizado',
  CANCELLED: 'Cancelado'
}

const LABEL_TO_STATUS = {
  Pendiente: 'DELIVERY_PENDING',
  Finalizado: 'FINALIZED',
  Cancelado: 'CANCELLED'
}

const CLOSURE_STATUS_TO_LABEL = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  VOIDED: 'Anulado'
}

const LABEL_TO_CLOSURE_STATUS = {
  Pendiente: 'PENDING',
  Verificado: 'VERIFIED',
  Anulado: 'VOIDED'
}

export const DEFAULT_PAGE_SIZE = 100
export const TABLE_ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100, 250, 500, 0]
export const TABLE_DEFAULT_PAGINATION = { rowsPerPage: DEFAULT_PAGE_SIZE }
export const LOAD_ALL_PAGE_SIZE = 1000000

export function paginationParams(extra = {}) {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...extra
  }
}

export function apiErrorMessage(error, fallback = 'Ocurrio un error') {
  if (error?.code === 'ECONNABORTED') return 'El servidor tardo demasiado en responder. Intenta nuevamente.'
  if (!error?.response && error?.message === 'Network Error') return 'No se pudo conectar con el servidor. Verifica la conexion e intenta nuevamente.'

  const data = error?.response?.data
  if (data?.message) return data.message
  if (data?.error) return data.error
  return fallback
}

export function assetUrl(path, baseUrl) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const cleanBaseUrl = String(baseUrl || '').replace(/\/$/, '')
  const cleanPath = String(path).replace(/^\//, '')

  return `${cleanBaseUrl}/${cleanPath}`
}

export function listFromResponse(response) {
  const payload = response?.data?.data ?? response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export async function listAllPages(apiClient, endpoint, params = {}) {
  const items = []
  let page = Number(params.page || 1)
  let totalPages = 1
  const pageSize = Number(params.pageSize || DEFAULT_PAGE_SIZE)

  do {
    const response = await apiClient.get(endpoint, {
      params: paginationParams({
        ...params,
        page,
        pageSize
      })
    })
    const pageItems = listFromResponse(response)
    items.push(...pageItems)

    const pagination = response?.data?.data?.pagination
    if (pagination?.totalPages !== undefined) {
      totalPages = Number(pagination.totalPages || 1)
    } else if (pageItems.length < pageSize) {
      totalPages = page
    } else {
      totalPages = page + 1
    }

    page += 1
  } while (page <= totalPages)

  return items
}

export function dataFromResponse(response) {
  return response?.data?.data ?? response?.data
}

export function roleLabel(user) {
  const firstRole = user?.roleAssignments?.[0]?.role || user?.roles?.[0]?.role || user?.roles?.[0]
  const roleKey = canonicalRoleKey(firstRole?.key || firstRole?.roleKey || user?.roles?.[0]?.roleKey || user?.roles?.[0] || user?.roleKey)
  const roleName = firstRole?.name || user?.roleName || user?.role || user?.rol
  if (ROLE_LABELS[roleKey]) return ROLE_LABELS[roleKey]
  if (roleName === 'Administrador') return 'Admin'
  if (ROLE_KEYS[roleName]) return ROLE_LABELS[ROLE_KEYS[roleName]] || roleName
  const normalizedNameKey = canonicalRoleKey(roleName)
  if (ROLE_LABELS[normalizedNameKey]) return ROLE_LABELS[normalizedNameKey]
  return roleName || ''
}

export function roleKeyFromLabel(label) {
  return ROLE_KEYS[label] || label
}

export function roleKeyFromUser(user) {
  const firstRole = user?.roleAssignments?.[0]?.role || user?.roles?.[0]?.role || user?.roles?.[0]
  const rawKey = firstRole?.key || firstRole?.roleKey || user?.roles?.[0]?.roleKey || user?.roles?.[0] || user?.roleKey
  const rawName = firstRole?.name || user?.roleName || user?.role || user?.rol
  const normalizedKey = canonicalRoleKey(rawKey)
  if (ROLE_LABELS[normalizedKey]) return normalizedKey
  return ROLE_KEYS[rawName] || ROLE_KEYS[roleLabel(user)] || normalizedKey || ''
}

export function normalizeProduct(product) {
  return {
    ...product,
    purchase_price: product.purchasePrice ?? product.purchase_price ?? 0,
    sale_price: product.salePrice ?? product.sale_price ?? 0,
    image_path: product.imagePath ?? product.image_path ?? null,
    quantity_sold: product.quantitySold ?? product.soldQuantity ?? product.totalSold ?? product.soldCount ?? 0
  }
}

export function normalizeUser(user) {
  const rol = roleLabel(user)
  const roleKey = roleKeyFromUser(user)
  return {
    ...user,
    rol,
    role_key: roleKey,
    roleKey,
    count_delivery: user.deliveriesCount ?? user.completedDeliveries ?? user.finalizedOrders ?? user.orders ?? 0,
    earned_delivery_pay: user.completedDeliveryPay ?? user.earnedMoney ?? user.messengerEarnings ?? user.totalEarned ?? 0,
    delivery_pay: user.completedDeliveryPay ?? user.earnedMoney ?? user.messengerEarnings ?? user.totalEarned ?? 0,
    pending_delivery_pay: user.pendingDeliveryPay ?? user.deliveryPayment ?? 0,
    money_pending: user.pendingMoney ?? user.pendingCash ?? 0,
    money_delivery: user.shippingCost ?? user.shippingMoney ?? user.messengerCost ?? 0,
    average: user.average ?? user.percentage ?? 0,
    count_perfum: user.productCount ?? user.perfumes ?? 0,
    cash_perfume: user.totalSold ?? user.totalSales ?? 0,
    cash_delivery: user.shippingCost ?? user.shippingMoney ?? 0,
    perfume_money_pay: user.perfumeMoney ?? user.perfumeCost ?? user.productIncome ?? 0,
    cash_net: user.net ?? user.sellerNet ?? user.netCash ?? 0,
    sale_total: user.internalSales ?? 0,
    total_sale: user.totalSold ?? user.totalSales ?? 0,
    cash_total: user.cash ?? 0,
    transfer_total: user.transfer ?? 0,
    net_total: user.net ?? user.netCash ?? 0
  }
}

export function userPayload(form) {
  return {
    name: form.name,
    email: form.email,
    ...(form.password ? { password: form.password } : {}),
    roleKey: roleKeyFromLabel(form.rol),
    status: 'ACTIVE',
    scope: 'GLOBAL'
  }
}

export function userUpdatePayload(form) {
  return {
    name: form.name,
    email: form.email,
    ...(form.password ? { password: form.password } : {}),
    status: 'ACTIVE',
    roleKey: roleKeyFromLabel(form.rol),
    scope: 'GLOBAL'
  }
}

export function storeFormData(form) {
  const formData = new FormData()
  formData.append('name', form.name)
  formData.append('purchasePrice', String(form.purchase_price ?? 0))
  formData.append('salePrice', String(form.sale_price ?? 0))
  formData.append('stock', String(form.stock ?? 0))
  if (form.description) formData.append('description', form.description)
  if (form.file instanceof File) formData.append('image', form.file)
  return formData
}

export function storePayload(form) {
  return {
    name: form.name,
    purchasePrice: String(form.purchase_price ?? 0),
    salePrice: String(form.sale_price ?? 0),
    stock: Number(form.stock ?? 0),
    ...(form.description ? { description: form.description } : {})
  }
}

export function normalizeSale(sale) {
  const source = sale?.sale || sale?.order || sale || {}
  const details = arrayFrom(source.details).map((detail) => ({
    ...detail,
    store_id: detail.storeId ?? detail.productId,
    product_id: detail.productId ?? detail.storeId,
    count: detail.quantity ?? detail.count ?? 0,
    quantity: detail.quantity ?? detail.count ?? 0,
    price: detail.unitPrice ?? detail.price ?? 0,
    name: detail.productName ?? detail.store?.name,
    image_path: detail.store?.imagePath ?? detail.imagePath ?? null
  }))

  return {
    ...source,
    employee_id: source.employee?.name || source.employeeId || '',
    messenger_id: source.messenger?.name || source.messengerId || '',
    seller_id: source.seller?.name || source.sellerId || '',
    employeeId: source.employeeId,
    messengerId: source.messengerId,
    sellerId: source.sellerId,
    amount: source.amount ?? source.total ?? 0,
    amount_cash: source.amountCash ?? source.cash ?? 0,
    amount_transfer: source.amountTransfer ?? source.transfer ?? 0,
    delivery_pay: source.deliveryPay ?? source.messengerCost ?? 0,
    count_perfume: source.perfumeCount ?? source.productCount ?? source.totalPerfumes ?? 0,
    location_url: source.locationUrl ?? source.location_url ?? '',
    state: source.statusLabel || STATUS_TO_LABEL[source.status] || source.status,
    type_pay: source.type_pay ?? (source.paymentMethod === 'CASH' ? 1 : 2),
    details
  }
}

export function salePayload(form) {
  const relationId = (selectValue, fallbackId, { allowNull = false } = {}) => {
    if (selectValue && typeof selectValue === 'object') return selectValue.value
    if (selectValue === undefined && allowNull) return fallbackId ?? undefined
    if (selectValue === null) return allowNull ? null : undefined
    if (selectValue === '') return allowNull ? null : undefined
    return fallbackId || selectValue || undefined
  }
  const isUpdate = Boolean(form.id)
  const employeeId = relationId(form.employee_id, form.employeeId)
  const sellerId = form.sellerCleared ? null : relationId(form.seller_id, form.sellerId, { allowNull: isUpdate })
  const messengerId = relationId(form.messenger_id, form.messengerId, { allowNull: isUpdate })
  const moneyValue = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return String(value)
  }
  const locationUrlValue = form.location_url === undefined || form.location_url === null
    ? undefined
    : String(form.location_url).trim()
  const locationUrlPayload = isUpdate
    ? { locationUrl: locationUrlValue || null }
    : (locationUrlValue ? { locationUrl: locationUrlValue } : {})

  return {
    amount: moneyValue(form.amount),
    amountCash: moneyValue(form.amount_cash),
    amountTransfer: moneyValue(form.amount_transfer),
    deliveryPay: moneyValue(form.delivery_pay),
    ...(form.phone ? { phone: form.phone } : {}),
    ...(form.description !== undefined && form.description !== null ? { description: String(form.description) } : {}),
    ...locationUrlPayload,
    ...(employeeId ? { employeeId } : {}),
    ...(messengerId !== undefined ? { messengerId } : {}),
    ...(sellerId !== undefined ? { sellerId } : {}),
    ...(form.state ? { status: LABEL_TO_STATUS[form.state] || form.state } : {}),
    items: (form.detail || []).map((item) => ({
      productId: item.product_id || item.store_id || item.productId,
      quantity: Number(item.quantity ?? item.count ?? 1)
    }))
  }
}

export function normalizeCashSummary(summary) {
  return {
    ...summary,
    total_sale: summary.totalSale ?? 0,
    total_cash: summary.totalCash ?? 0,
    total_trans: summary.totalTransfer ?? 0,
    total_cash_messenger: summary.totalMessengerCost ?? 0,
    pending_cash: summary.pendingCash ?? summary.pendingCashTotal ?? summary.totalPendingCash ?? summary.pendingCashAmount ?? 0,
    pending_money: summary.pendingMoney ?? summary.pendingSalesMoney ?? summary.pendingAmount ?? 0,
    neto_total: summary.netTotal ?? 0,
    detail_messenger: (summary.detailMessenger || []).map(normalizeMessengerDetail),
    detail_seller: (summary.detailSeller || []).map(normalizeSellerDetail),
    detail_employee: (summary.detailEmployee || []).map(normalizeEmployeeDetail)
  }
}

export function normalizeMessengerDetail(row) {
  return {
    ...row,
    name: row.messenger?.name || row.name,
    count_delivery: row.finalizedDeliveries ?? row.deliveries ?? row._count?.id ?? 0,
    deliveries: row.finalizedDeliveries ?? row.deliveries ?? row._count?.id ?? 0,
    earned: row.completedDeliveryPay ?? row.earnedMoney ?? row.messengerEarnings ?? row.totalEarned ?? 0,
    earned_delivery_pay: row.completedDeliveryPay ?? row.earnedMoney ?? row.messengerEarnings ?? row.totalEarned ?? 0,
    pending_delivery_pay: row.pendingDeliveryPay ?? 0,
    money_pending: row.pendingMoney ?? 0
  }
}

export function normalizeSellerDetail(row) {
  return {
    ...row,
    'seller.name': row.seller?.name || row['seller.name'],
    total: row.totalSold ?? row.total ?? row.sold ?? 0,
    sold: row.totalSold ?? row.total ?? row.sold ?? 0,
    messenger_cost: row.shippingCost ?? row.messenger_cost ?? row.delivery_cost ?? 0,
    delivery_cost: row.shippingCost ?? row.messenger_cost ?? row.delivery_cost ?? 0,
    orders_count: row.finalizedDeliveries ?? row.orders_count ?? row._count?.id ?? 0,
    deliveries: row.finalizedDeliveries ?? row.deliveries ?? row._count?.id ?? 0,
    perfumes_sold: row.quantity ?? row.perfumes_sold ?? row._sum?.perfumeCount ?? 0,
    perfumes: row.quantity ?? row.perfumes ?? row._sum?.perfumeCount ?? 0,
    perfume_cost: row.perfumeCost ?? row.perfume_cost ?? 0,
    money_winned: row.amountToPay ?? row.money_winned ?? 0
  }
}

export function normalizeEmployeeDetail(row) {
  return {
    ...row,
    'employee.name': row.employee?.name || row['employee.name'],
    sale_total: row.internalSale ?? row.sale_total ?? 0,
    total: row.totalSold ?? row.total ?? 0,
    sold: row.totalSold ?? row.sold ?? row.total ?? 0,
    cash_total: row.cash ?? row.cash_total ?? 0,
    cash: row.cash ?? row.cash_total ?? 0,
    transfer_total: row.transfer ?? row.transfer_total ?? 0,
    orders_count: row.finalizedDeliveries ?? row.orders_count ?? row._count?.id ?? 0,
    orders: row.finalizedDeliveries ?? row.orders ?? row._count?.id ?? 0,
    perfumes_sold: row.quantity ?? row.perfumes_sold ?? row._sum?.perfumeCount ?? 0,
    messenger_cost: row.shippingCost ?? row.messenger_cost ?? 0,
    money_delivery: row.shippingCost ?? row.money_delivery ?? 0,
    net: row.net ?? row.netCash ?? 0
  }
}

export function normalizeClosure(closure) {
  return {
    ...closure,
    name: closure.name || `${String(closure.fromDate || '').slice(0, 10)} - ${String(closure.toDate || '').slice(0, 10)}`,
    note: closure.note || '',
    from_date: closure.fromDate,
    to_date: closure.toDate,
    total_sale: closure.totalSale ?? closure.gross ?? 0,
    total_cash: closure.totalCash ?? closure.cash ?? 0,
    total_trans: closure.totalTransfer ?? closure.transfer ?? 0,
    total_messenger_cost: closure.totalMessengerCost ?? closure.messengerCost ?? 0,
    internal_sales: closure.internalSales ?? closure.internalSale ?? 0,
    general_sales: closure.generalSales ?? closure.generalSale ?? 0,
    net_total: closure.netTotal ?? closure.net ?? 0,
    total_perfumes: closure.totalPerfumes ?? closure.productCount ?? 0,
    pending_money: closure.pendingSalesMoney ?? closure.pendingAmount ?? closure.pendingMoney ?? 0,
    pending_messenger_pay: closure.pendingPayments ?? closure.pendingPayment ?? closure.pendingMessengerCost ?? closure.pendingMessengerPay ?? 0,
    status: CLOSURE_STATUS_TO_LABEL[closure.status] || closure.status
  }
}

export function closureStatusPayload(status) {
  return { status: LABEL_TO_CLOSURE_STATUS[status] || status }
}

export function normalizeClosureDetail(detail) {
  const closure = normalizeClosure(detail.closure || detail)
  const messengers = arrayFrom(detail.detailMessenger || detail.messengers)
  const sellers = arrayFrom(detail.detailSeller || detail.sellers)
  const employees = arrayFrom(detail.detailEmployee || detail.employees)
  const sales = arrayFrom(detail.orderDetails || detail.sales || detail.details)

  return {
    closure,
    messengers: messengers.map(normalizeMessengerDetail),
    sellers: sellers.map(normalizeSellerDetail),
    employees: employees.map(normalizeEmployeeDetail),
    sales: sales.map(normalizeSale)
  }
}

function arrayFrom(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.rows)) return value.rows
  if (value?.sale || value?.order) return [value]
  return []
}

export function normalizeInventoryPreview(data) {
  const items = data?.items || data?.products || []
  return {
    products: items.map((item) => ({
      ...item,
      name: item.name || item.product,
      sale_price: item.price ?? item.purchasePrice ?? 0,
      inventory_value: item.inventoryValue ?? 0
    })),
    totals: {
      total_products: data?.totals?.totalProducts ?? 0,
      total_inventory_value: data?.totals?.totalInventoryValue ?? 0
    }
  }
}

export function normalizeInventoryReport(report) {
  return {
    ...report,
    name: report.name || 'Reporte de inventario',
    note: report.note || '',
    from: formatReportDate(report.createdAt || report.date),
    total_products: report.totalProducts ?? 0,
    total_inventory_value: report.totalInventoryValue ?? report.inventoryValue ?? 0
  }
}

export function normalizeInventoryReportDetail(report) {
  const details = report.details || report.detailItems || []
  return {
    ...report,
    details: details.map((item) => ({
      ...item,
      product_id: item.productId,
      product_name: item.productName || item.product,
      price: item.price ?? item.purchasePrice ?? 0,
      inventory_value: item.inventoryValue ?? item.value ?? 0
    }))
  }
}

function formatReportDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)

  const yyyyMmDd = date.toLocaleDateString('sv-SE')
  const today = new Date().toLocaleDateString('sv-SE')

  return yyyyMmDd === today ? 'Hoy' : yyyyMmDd
}
