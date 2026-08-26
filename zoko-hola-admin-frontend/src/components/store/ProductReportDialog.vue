<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="product-report-dialog column no-wrap" :class="{ 'product-report-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="assessment" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Reporte de inventario</div>
          <div class="text-caption text-grey-7">Consulta el resumen y valor actual del almacen.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="close" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 col-sm-6">
            <q-card flat bordered class="product-report-panel bg-white q-pa-md">
              <div class="row items-center no-wrap">
                <q-avatar color="grey-2" text-color="grey-8" icon="inventory_2" />
                <div class="q-ml-md">
                  <div class="text-caption text-grey-7">Productos registrados</div>
                  <div class="text-h6 text-weight-bold">{{ reportTotals.total_products || 0 }}</div>
                </div>
              </div>
            </q-card>
          </div>
          <div class="col-12 col-sm-6">
            <q-card flat bordered class="product-report-panel bg-white q-pa-md">
              <div class="row items-center no-wrap">
                <q-avatar color="yellow-9" text-color="dark" icon="payments" />
                <div class="q-ml-md">
                  <div class="text-caption text-grey-7">Valor total en inventario</div>
                  <div class="text-h6 text-weight-bold">{{ formatMoney(reportTotals.total_inventory_value) }}</div>
                </div>
              </div>
            </q-card>
          </div>
        </div>

        <q-card flat bordered class="product-report-panel bg-white">
          <q-table
            class="product-report-table"
            :rows="reportProducts"
            :columns="columnsReport"
            :filter="filter"
            row-key="id"
            flat
            :pagination="{ rowsPerPage: 100 }"
            :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"
          >
            <template #top>
              <div class="row items-center full-width q-px-md q-py-sm q-col-gutter-md">
                <div class="col-12 col-sm">
                  <div class="text-subtitle1 text-weight-bold">Detalle de productos</div>
                  <div class="text-caption text-grey-7">Existencia y valor por cada producto.</div>
                </div>
                <div class="col-12 col-sm-auto">
                  <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar producto" class="product-report-search">
                    <template #append><q-icon name="search" /></template>
                  </q-input>
                </div>
              </div>
            </template>

            <template #body-cell-sale_price="props">
              <q-td :props="props" align="right">{{ formatMoney(props.row.sale_price) }}</q-td>
            </template>
            <template #body-cell-inventory_value="props">
              <q-td :props="props" align="right" class="text-weight-bold">{{ formatMoney(props.row.inventory_value) }}</q-td>
            </template>
          </q-table>
        </q-card>

        <q-card v-if="isAdmin" flat bordered class="product-report-panel bg-white q-pa-md q-mt-lg">
          <div class="row items-start q-gutter-sm q-mb-md">
            <q-icon name="description" size="20px" color="grey-8" />
            <div>
              <div class="text-subtitle1 text-weight-bold">Guardar reporte</div>
              <div class="text-caption text-grey-7">Asigna un nombre y una nota opcional antes de crearlo.</div>
            </div>
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-5"><q-input v-model="data.reportName" outlined color="black" label="Nombre del reporte" /></div>
            <div class="col-12 col-sm-7"><q-input v-model="data.reportNote" outlined color="black" label="Nota" type="textarea" autogrow /></div>
          </div>
        </q-card>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
        <q-btn flat color="grey-8" label="Cerrar" @click="close" />
        <q-btn v-if="isAdmin" unelevated color="yellow-9" text-color="dark" icon="save" label="Guardar reporte" @click="$emit('save')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: 'ProductReportDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    reportProducts: { type: Array, default: () => [] },
    reportTotals: { type: Object, required: true },
    data: { type: Object, required: true },
    isAdmin: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'save'],
  data() {
    return {
      filter: '',
      columnsReport: [
        { name: 'name', label: 'Producto', field: 'name', align: 'center', sortable: true },
        { name: 'stock', label: 'Stock', field: 'stock', align: 'center', sortable: true },
        { name: 'sale_price', label: 'Precio', field: 'sale_price', align: 'center', sortable: true },
        { name: 'inventory_value', label: 'Valor en inventario', field: 'inventory_value', align: 'center', sortable: true },
      ],
    };
  },
  methods: {
    close() { this.$emit('update:modelValue', false); },
    formatMoney(value) {
      return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(Number(value || 0));
    },
  },
};
</script>

<style scoped>
.product-report-dialog { width: min(1080px, 96vw); height: min(800px, calc(100vh - 32px)); max-width: 1080px; border-radius: 18px; }
.product-report-dialog--mobile { height: calc(100vh - 32px); border-radius: 18px; }
.product-report-panel { border-radius: 16px; }
.product-report-table { max-height: 410px; }
.product-report-search { min-width: 230px; }
:deep(.q-table th), :deep(.q-table td) { text-align: center !important; }
@media (max-width: 599px) { .product-report-table { max-height: none; } .product-report-search { min-width: 0; } }
</style>
