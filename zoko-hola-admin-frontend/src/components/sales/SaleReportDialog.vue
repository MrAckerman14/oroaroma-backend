<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="sale-report-dialog column no-wrap">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="account_balance_wallet" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Cierre de caja</div>
          <div class="text-caption text-grey-7">Resumen financiero de las ventas registradas.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="close" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">Resumen financiero</div>
        <div class="text-caption text-grey-7 q-mb-md">Totales consolidados antes de crear el cierre.</div>
        <div class="row q-col-gutter-md">
          <div v-for="item in summaryItems" :key="item.label" class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="sale-report-panel q-pa-md bg-white" :class="{ 'sale-report-panel--accent': item.highlight }">
              <div class="text-caption text-grey-7">{{ item.label }}</div>
              <div class="text-h6 text-weight-bold q-mt-xs">{{ moneyFormat(item.value) }}</div>
            </q-card>
          </div>
        </div>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Desglose por equipo</div>
        <q-card flat bordered class="sale-report-panel bg-white">
          <q-expansion-item default-opened icon="local_shipping" label="Mensajeros" caption="Entregas y pagos asociados" header-class="text-weight-bold">
            <q-separator />
            <q-table dense flat binary-state-sort :rows="report?.detail_messenger || []" :columns="tableColumns(messengerColumns)" row-key="messenger_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]" />
          </q-expansion-item>
          <q-separator v-if="isAdmin" />
          <q-expansion-item v-if="isAdmin" icon="handshake" label="Colaboradores" caption="Ventas, costos y montos por liquidar" header-class="text-weight-bold">
            <q-separator />
            <q-table dense flat binary-state-sort :rows="report?.detail_seller || []" :columns="tableColumns(sellerCols)" row-key="seller_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]" />
          </q-expansion-item>
          <q-separator v-if="isAdmin" />
          <q-expansion-item v-if="isAdmin" icon="badge" label="Vendedores" caption="Actividad y resultados de venta interna" header-class="text-weight-bold">
            <q-separator />
            <q-table dense flat binary-state-sort :rows="report?.detail_employee || []" :columns="tableColumns(employerCols)" row-key="employee_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]" />
          </q-expansion-item>
        </q-card>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
        <q-btn flat color="grey-8" label="Cerrar" @click="close" />
        <q-btn v-if="isAdmin" unelevated color="yellow-9" text-color="dark" icon="save" label="Crear cierre de caja" @click="$emit('send-closure')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: 'SaleReportDialog',
  props: { modelValue: { type: Boolean, default: false }, report: { type: Object, required: true }, isAdmin: { type: Boolean, default: false } },
  emits: ['update:modelValue', 'send-closure'],
  data() {
    const numberFormat = (value) => new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(Number(value || 0));
    const moneyFormat = (value) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(Number(value || 0));

    return {
      messengerCols: [
        { name: 'name', label: 'Mensajero', field: (row) => row.messenger?.name || '-' },
        { name: 'count_delivery', label: 'Cantid. envios', field: 'count_delivery', format: numberFormat },
        { name: 'earned', label: 'Dinero ganado', field: 'earned', format: moneyFormat },
        { name: 'pending_delivery_pay', label: 'Pago de envio pendiente', field: 'pending_delivery_pay', format: moneyFormat },
        { name: 'money_pending', label: 'Pendiente', field: 'money_pending', format: moneyFormat },
      ],
      sellerCols: [
        { name: 'name', label: 'Colaborador', field: (row) => row['seller.name'] || '-' },
        { name: 'total', label: 'Total', field: 'total', format: moneyFormat },
        { name: 'messenger_cost', label: 'Envio', field: 'messenger_cost', format: moneyFormat },
        { name: 'orders_count', label: 'Cantidad de envios', field: 'orders_count', format: numberFormat },
        { name: 'perfumes_sold', label: 'Cantidad', field: 'perfumes_sold', format: numberFormat },
        { name: 'perfume_cost', label: 'Costo de perfume', field: 'perfume_cost', format: moneyFormat },
        { name: 'money_winned', label: 'Monto a pagar', field: (row) => Number(row.total || 0) - Number(row.messenger_cost || 0) - Number(row.perfume_cost || 0), format: moneyFormat },
      ],
      employerCols: [
        { name: 'name', label: 'Vendedor', field: (row) => row.employee?.name || '-' },
        { name: 'sale_total', label: 'Venta interna', field: 'sale_total', format: moneyFormat },
        { name: 'total', label: 'Total', field: 'total', format: moneyFormat },
        { name: 'cash_total', label: 'Efectivo', field: 'cash_total', format: moneyFormat },
        { name: 'transfer_total', label: 'Transferencia', field: 'transfer_total', format: moneyFormat },
        { name: 'orders_count', label: 'Cantidad de envios', field: 'orders_count', format: numberFormat },
        { name: 'perfumes_sold', label: 'Cantidad', field: 'perfumes_sold', format: numberFormat },
        { name: 'messenger_cost', label: 'Mensajeria', field: 'messenger_cost', format: moneyFormat },
        { name: 'net', label: 'Neto', field: (row) => Number(row.cash_total || 0) - Number(row.messenger_cost || 0), format: moneyFormat },
      ],
    };
  },
  computed: {
    summaryItems() {
      return [
        { label: 'Total vendido', value: this.report?.total_sale },
        { label: 'Total efectivo', value: this.report?.total_cash },
        { label: 'Total transferencias', value: this.report?.total_trans },
        { label: 'Pago mensajero', value: this.report?.total_cash_messenger },
        { label: 'Dinero pendiente', value: this.report?.pending_cash },
        { label: 'Total neto', value: this.report?.neto_total, highlight: true },
      ];
    },
    messengerColumns() { return this.isAdmin ? this.messengerCols : this.messengerCols.filter((column) => column.name !== 'earned'); },
  },
  methods: {
    tableColumns(columns) { return columns.map((column) => ({ ...column, align: 'center', sortable: true })); },
    close() { this.$emit('update:modelValue', false); },
    moneyFormat(value) { return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(Number(value || 0)); },
  },
};
</script>

<style scoped>
.sale-report-dialog { width: min(1040px, 96vw); height: min(780px, calc(100vh - 32px)); max-width: 1040px; border-radius: 18px; }
.sale-report-panel { border-radius: 16px; }
.sale-report-panel--accent { background: var(--app-primary-soft); border-color: var(--app-primary-border); }
@media (max-width: 599px) { .sale-report-dialog { width: min(94vw, 760px); height: calc(100vh - 32px); border-radius: 18px; } }
</style>
