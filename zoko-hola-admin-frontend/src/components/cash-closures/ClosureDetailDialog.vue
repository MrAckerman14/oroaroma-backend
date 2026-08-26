<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="
      $emit('update:modelValue', $event)
    "
  >
    <q-card class="closure-detail-dialog column no-wrap">
      <!-- ========================= -->
      <!-- BARRA SUPERIOR -->
      <!-- ========================= -->

      <q-card-section class="closure-header row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="account_balance_wallet" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">
          {{
            closureData?.closure?.name ||
            `Cierre #${closureData?.closure?.id}`
          }}
          </div>
          <div class="text-caption text-grey-9">
            Resumen operativo del cierre
          </div>
        </div>

        <q-space />

        <q-btn
          flat
          round
          dense
          icon="close"
          @click="
            $emit(
              'update:modelValue',
              false
            )
          "
        />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">

      <q-card flat bordered class="closure-detail-panel q-pa-md bg-white q-mb-lg">
        <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar en el cierre">
          <template #append><q-icon name="search" /></template>
        </q-input>
      </q-card>

      <!-- ========================= -->
      <!-- RESUMEN -->
      <!-- ========================= -->

      <q-card-section class="q-pt-md q-pb-sm">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">
          Resumen financiero
        </div>
        <div class="text-caption text-grey-7 q-mb-md">
          Totales consolidados para este cierre de caja.
        </div>

        <div class="closure-summary">
        <!-- EFECTIVO -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Efectivo
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.total_cash
              )
            }}
          </div>
        </q-card>

        <!-- TRANSFERENCIAS -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Transferencias
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.total_trans
              )
            }}
          </div>
        </q-card>

        <!-- MENSAJERIA -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Mensajería
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.total_messenger_cost
              )
            }}
          </div>
        </q-card>

        <!-- VENTA INTERNA -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Venta interna
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.internal_sales
              )
            }}
          </div>
        </q-card>

        <!-- VENTA GENERAL -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Venta general
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.general_sales
              )
            }}
          </div>
        </q-card>

        <!-- NETO -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Neto
          </div>

          <div class="text-h6">
            RD$
            {{
              format(
                closureData?.closure
                  ?.net_total
              )
            }}
          </div>
        </q-card>

        <!-- PERFUMES -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Perfumes
          </div>

          <div class="text-h6">
            {{
              closureData?.closure
                ?.total_perfumes
            }}
          </div>
        </q-card>

        <!-- DINERO PENDIENTE -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Dinero pendiente
          </div>

          <div class="text-h6">
            RD$
            {{ format(totalPending) }}
          </div>
        </q-card>

        <!-- PAGOS PENDIENTES -->

        <q-card
          class="col-12 col-sm-6 col-md text-center"
        >
          <div class="text-caption">
            Pagos pendientes
          </div>

          <div class="text-h6">
            RD$
            {{ format(totalPayMessenger) }}
          </div>
        </q-card>
        </div>
      </q-card-section>

      <!-- ========================= -->
      <!-- MENSAJEROS -->
      <!-- ========================= -->

      <q-card-section class="detail-section">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">
          Mensajeros
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          Entregas y pagos asociados al cierre.
        </div>

        <q-table
          dense
          flat
          :filter="filter"
          :rows="
            closureData?.messengers || []
          "
          :columns="tableColumns(messengerCols)"
          row-key="id mensajero"
          binary-state-sort
          :pagination="{
            rowsPerPage: 100
          }"
          :rows-per-page-options="[
            5,
            10,
            25,
            50,
            100,
            250,
            500,
            0
          ]"
        />
      </q-card-section>

      <!-- ========================= -->
      <!-- COLABORADORES -->
      <!-- ========================= -->

      <q-card-section class="detail-section">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">
          Colaboradores
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          Ventas, costos y montos por liquidar.
        </div>

        <q-table
          dense
          flat
          :filter="filter"
          :rows="
            closureData?.sellers || []
          "
          :columns="tableColumns(sellerCols)"
          row-key="id venta"
          binary-state-sort
          :pagination="{
            rowsPerPage: 100
          }"
          :rows-per-page-options="[
            5,
            10,
            25,
            50,
            100,
            250,
            500,
            0
          ]"
        />
      </q-card-section>

      <!-- ========================= -->
      <!-- VENDEDORES -->
      <!-- ========================= -->

      <q-card-section class="detail-section">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">
          Vendedores
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          Actividad y resultados de venta interna.
        </div>

        <q-table
          dense
          flat
          :filter="filter"
          :rows="
            closureData?.employees || []
          "
          :columns="tableColumns(employeeCols)"
          row-key="employee_id"
          binary-state-sort
          :pagination="{
            rowsPerPage: 100
          }"
          :rows-per-page-options="[
            5,
            10,
            25,
            50,
            100,
            250,
            500,
            0
          ]"
        />
      </q-card-section>

      <!-- ========================= -->
      <!-- DETALLE -->
      <!-- ========================= -->

      <q-card-section class="detail-section">
        <div class="text-subtitle1 text-weight-bold q-mb-xs">
          Detalle de ventas
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          Operaciones incluidas en este cierre.
        </div>

        <q-table
          flat
          :filter="filter"
          :rows="
            closureData?.sales || []
          "
          :columns="tableColumns(saleCols)"
          row-key="id"
          binary-state-sort
          :pagination="{
            rowsPerPage: 100
          }"
          :rows-per-page-options="[
            5,
            10,
            25,
            50,
            100,
            250,
            500,
            0
          ]"
        />
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
  name: "ClosureDetailDialog",

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },

    closureData: {
      type: Object,
      default: null,
    },

    totalPending: {
      default: null,
    },

    totalPayMessenger: {
      default: null,
    },
  },

  data() {
    const format = (v) =>
      new Intl.NumberFormat(
        "es-DO"
      ).format(v || 0);

    const formatDate = (d) =>
      new Date(d).toLocaleDateString();

    return {
      filter: "",
      // =======================================================
      // MENSAJEROS
      // =======================================================

      messengerCols: [
        {
          name: "name",
          label: "Mensajero",
          field: (row) =>
            row["name"],
          align: "left",
        },

        {
          name: "deliveries",
          label: "envíos entregados",
          field: "deliveries",
          align: "center",
        },

        {
          name: "earned",
          label: "Dinero ganado",
          field: "earned",
          align: "right",
          format,
        },

        {
          name:
            "pending_delivery_pay",

          label:
            "Pago envio pendiente",

          field:
            "pending_delivery_pay",

          align: "right",

          format,
        },

        {
          name: "money_pending",
          label: "Dinero pendiente",
          field: "money_pending",
          align: "center",
        },
      ],

      // =======================================================
      // COLABORADORES
      // =======================================================

      sellerCols: [
        {
          name: "name",
          label: "Colaborador",
          field: (row) =>
            row["seller.name"],
        },

        {
          name: "perfumes",
          label: "Perfumes vendidos",
          field: "perfumes",
          align: "center",
        },

        {
          name: "shipments",
          label: "Cantidad de envíos",
          field: "deliveries",
          align: "center",
        },

        {
          name: "sold",
          label: "Total vendido",
          field: "sold",
          align: "right",
          format,
        },

        {
          name: "delivery_cost",
          label: "Costo mensajería",
          field: "delivery_cost",
          align: "right",
          format,
        },

        {
          name: "perfume_cost",
          label: "Costo perfume",
          field: "perfume_cost",
          align: "right",
          format,
        },

        {
          name: "pending_payment",

          label: "Monto a pagar",

          field: (row) => {
            const sale = Number(
              row.sold || 0
            );

            const delivery =
              Number(
                row.delivery_cost || 0
              );

            const perfume =
              Number(
                row.perfume_cost || 0
              );

            return (
              sale -
              delivery -
              perfume
            );
          },

          align: "right",

          format,
        },
      ],

      // =======================================================
      // VENDEDORES
      // =======================================================

      employeeCols: [
        {
          name: "name",
          label: "Vendedor",
          field: (row) =>
            row["employee.name"],
        },

        {
          name: "orders",
          label: "Cantidad de pedidos",
          field: "orders",
          align: "center",
        },

        {
          name: "sale_total",
          label: "Venta interna",
          field: "sale_total",
          align: "right",
          format,
        },

        {
          name: "sold",
          label: "Total vendido",
          field: "sold",
          align: "right",
          format,
        },

        {
          name: "cash",
          label: "Efectivo",
          field: "cash",
          align: "right",
          format,
        },

        {
          name: "transfer_total",
          label: "Transferencia",
          field: "transfer_total",
          align: "right",
          format,
        },

        {
          name: "money_delivery",
          label: "Mensajería",
          field: "money_delivery",
          align: "right",
          format,
        },

        {
          name: "net",

          label: "Neto",

          field: (row) => {
            let cash = Number(
              row.cash || 0
            );

            let messenger = Number(
              row.money_delivery || 0
            );

            return (
              cash - messenger
            );
          },

          align: "right",

          format,
        },
      ],

      // =======================================================
      // DETALLE DE VENTAS
      // =======================================================

      saleCols: [
        {
          name: "id",
          label: "#",
          field: "id",
          align: "center",
        },

        {
          name: "state",
          label: "Estado",
          field: "state",
          align: "center",
        },

        {
          name: "date",
          label: "Fecha",
          field: (row) =>
            formatDate(
              row.createdAt
            ),
        },

        {
          name: "employee",
          label: "Vendedor",
          field: (row) =>
            row.employee?.name ||
            "-",
        },

        {
          name: "seller",
          label: "Colaborador",
          field: (row) =>
            row.seller?.name ||
            "-",
        },

        {
          name: "messenger",
          label: "Mensajero",
          field: (row) =>
            row.messenger?.name ||
            "-",
        },

        {
          name: "perfumes",
          label: "Perfumes",
          field: "count_perfume",
          align: "center",
        },

        {
          name: "delivery",
          label: "Mensajería",
          field: "delivery_pay",
          align: "right",
          format,
        },

        {
          name: "amount",
          label: "Total",
          field: "amount",
          align: "right",
          format,
        },

        {
          name: "pay",

          label: "Forma de pago",

          field: (row) =>
            row.type_pay === 1
              ? "Efectivo"
              : "Transferencia",
        },
      ],
    };
  },

  methods: {
    tableColumns(columns) {
      return columns.map((column) => ({ ...column, align: "center", sortable: true }));
    },
    format(v) {
      return new Intl.NumberFormat(
        "es-DO"
      ).format(v || 0);
    },
  },
};
</script>

<style scoped>
.closure-detail-dialog {
  width: min(1180px, calc(100vw - 32px));
  height: min(820px, calc(100vh - 32px));
  max-width: 1180px;
  border-radius: 18px;
}

.closure-header {
  min-height: 76px;
}

.closure-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.1);
}

.closure-summary > .q-card {
  width: auto !important;
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #e7e7e7;
  border-radius: 16px;
  box-shadow: none;
}

.closure-summary > .q-card .text-caption {
  color: #6b6b6b;
}

.closure-summary > .q-card .text-h6 {
  margin-top: 4px;
  font-weight: 700;
}

.closure-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.closure-summary > .q-card:nth-child(6) {
  background: var(--app-primary-soft);
  border-color: var(--app-primary-border);
}

.detail-section {
  padding: 8px 0 0;
}

.detail-section :deep(.q-table__container) {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e7e7e7;
  border-radius: 16px;
}

.closure-detail-panel {
  border-radius: 16px;
}

.detail-section :deep(thead tr) {
  background: var(--app-primary-soft);
}

.detail-section :deep(th) {
  color: #3a3a3a;
  font-weight: 700;
}

@media (max-width: 599px) {
  .closure-detail-dialog {
    width: min(94vw, 760px);
    height: calc(100vh - 32px);
    border-radius: 18px;
  }

  .closure-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 600px) and (max-width: 1023px) {
  .closure-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
