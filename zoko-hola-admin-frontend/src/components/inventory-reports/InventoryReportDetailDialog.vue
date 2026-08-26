<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="inventory-report-dialog column no-wrap">
      <q-card-section class="report-header row items-center no-wrap q-px-lg q-py-md bg-white">
        <div class="col row items-center no-wrap">
          <q-avatar color="yellow-9" text-color="dark" icon="inventory_2" />

          <div class="q-ml-md">
            <div class="text-h6 text-weight-bold">
              {{ selectedReport?.name || "Detalle del reporte" }}
            </div>
            <div class="text-caption text-grey-9">
              <q-icon name="event" size="15px" class="q-mr-xs" />
              {{ reportDate }}
              <span class="q-mx-xs">&middot;</span>
              {{ detailCount }} productos registrados
            </div>
          </div>

          <q-space />

          <q-btn
            aria-label="Cerrar detalle"
            icon="close"
            flat
            round
            dense
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">

      <q-card-section class="q-pt-md q-pb-sm">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-card flat bordered class="metric-card">
              <q-card-section>
                <div class="text-caption text-grey-7">
                  Unidades en inventario
                </div>
                <div class="text-h5 text-weight-bold q-mt-xs">
                  {{ selectedReportTotals.total_products.toLocaleString() }}
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-12 col-sm-4">
            <q-card flat bordered class="metric-card">
              <q-card-section>
                <div class="text-caption text-grey-7">
                  Productos diferentes
                </div>
                <div class="text-h5 text-weight-bold q-mt-xs">
                  {{ detailCount.toLocaleString() }}
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-12 col-sm-4">
            <q-card flat bordered class="metric-card metric-card--accent">
              <q-card-section>
                <div class="text-caption text-grey-7">
                  Valor del inventario
                </div>
                <div class="text-h5 text-weight-bold q-mt-xs">
                  {{ money(selectedReportTotals.total_value) }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <q-card flat bordered class="detail-card">
          <q-card-section class="row items-center q-py-sm">
            <div>
              <div class="text-subtitle1 text-weight-bold">
                Productos incluidos
              </div>
              <div class="text-caption text-grey-7">
                Existencia y valoración al momento de generar el reporte.
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-table
            :rows="selectedReport?.details || []"
            :columns="detailColumns"
            :filter="filter"
            row-key="product_id"
            flat
            binary-state-sort
            :pagination="{ rowsPerPage: 100 }"
            :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"
          >
            <template #top-right>
              <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar">
                <template #append><q-icon name="search" /></template>
              </q-input>
            </template>
            <template #no-data>
              <div class="full-width row flex-center q-pa-xl text-grey-7">
                <div class="text-center">
                  <q-icon name="inventory_2" size="42px" />
                  <div class="q-mt-sm text-weight-medium">
                    No hay productos en este reporte.
                  </div>
                </div>
              </div>
            </template>
          </q-table>
        </q-card>
      </q-card-section>

      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
        <q-btn
          unelevated
          color="yellow-9"
          text-color="dark"
          icon="close"
          label="Cerrar"
          @click="$emit('update:modelValue', false)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "InventoryReportDetailDialog",

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },

    selectedReport: {
      type: Object,
      default: null,
    },
  },

  computed: {
    selectedReportTotals() {
      const details = this.selectedReport?.details || [];

      return details.reduce(
        (acc, item) => {
          acc.total_products += Number(item.stock || 0);
          acc.total_value += Number(item.inventory_value || 0);

          return acc;
        },
        {
          total_products: 0,
          total_value: 0,
        }
      );
    },

    detailCount() {
      return (this.selectedReport?.details || []).length;
    },

    reportDate() {
      return this.formatDate(
        this.selectedReport?.createdAt ||
          this.selectedReport?.date ||
          this.selectedReport?.from
      );
    },
  },

  data() {
    return {
      filter: "",
      detailColumns: [
        {
          name: "product_name",
          label: "Producto",
          field: "product_name",
          align: "center",
          classes: "text-weight-medium",
          sortable: true,
        },
        {
          name: "stock",
          label: "Existencia",
          field: "stock",
          align: "center",
          format: (value) => Number(value || 0).toLocaleString(),
          sortable: true,
        },
        {
          name: "price",
          label: "Costo unitario",
          field: "price",
          align: "center",
          format: (value) => this.money(value),
          sortable: true,
        },
        {
          name: "inventory_value",
          label: "Valor total",
          field: "inventory_value",
          align: "center",
          classes: "text-weight-bold",
          format: (value) => this.money(value),
          sortable: true,
        },
      ],
    };
  },

  methods: {
    money(value) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        maximumFractionDigits: 2,
      }).format(Number(value || 0));
    },

    formatDate(value) {
      if (!value) return "Fecha no disponible";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return String(value);

      return date.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
  },
};
</script>

<style scoped>
.inventory-report-dialog {
  width: min(1120px, calc(100vw - 32px));
  height: min(800px, calc(100vh - 32px));
  max-width: 1120px;
  border-radius: 18px;
}

.report-header {
  min-height: 76px;
}

.metric-card,
.detail-card {
  border-radius: 16px;
}

.metric-card--accent {
  border-color: var(--app-primary);
  background: #fffdf7;
}

:deep(.q-table th), :deep(.q-table td) {
  text-align: center !important;
}

@media (max-width: 599px) {
  .inventory-report-dialog {
    width: min(94vw, 760px);
    height: calc(100vh - 32px);
    border-radius: 18px;
  }
}
</style>
