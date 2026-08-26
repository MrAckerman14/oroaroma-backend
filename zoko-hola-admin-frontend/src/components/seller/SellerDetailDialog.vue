<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card
      class="seller-detail-dialog column no-wrap"
      :class="{ 'seller-detail-dialog--mobile': $q.screen.lt.sm }"
    >
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="person" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Detalle del vendedor</div>
          <div class="text-caption text-grey-7">Información, desempeño y resumen financiero.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <q-card flat bordered class="seller-detail-panel q-pa-md bg-white">
          <div class="row items-center no-wrap">
            <q-avatar size="52px" color="grey-9" text-color="yellow-9" icon="person" />
            <div class="col q-ml-md">
              <div class="text-subtitle1 text-weight-bold">{{ seller?.name || "Sin nombre" }}</div>
              <div class="text-caption text-grey-7 ellipsis">{{ seller?.email || "Sin correo registrado" }}</div>
            </div>
            <q-badge outline color="grey-8">{{ seller?.rol || "Vendedor" }}</q-badge>
          </div>
        </q-card>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Actividad</div>
        <div class="row q-col-gutter-md">
          <div class="col-6 col-sm-3">
            <q-card flat bordered class="seller-detail-panel bg-white q-pa-md text-center">
              <q-icon name="local_shipping" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ quantity(seller?.count_delivery) }}</div>
              <div class="text-caption text-grey-7">Envíos</div>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered class="seller-detail-panel bg-white q-pa-md text-center">
              <q-icon name="inventory_2" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ quantity(seller?.count_perfum) }}</div>
              <div class="text-caption text-grey-7">Perfumes</div>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered class="seller-detail-panel bg-white q-pa-md text-center">
              <q-icon name="trending_up" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ average(seller?.average) }}</div>
              <div class="text-caption text-grey-7">Promedio</div>
            </q-card>
          </div>
          <div class="col-6 col-sm-3">
            <q-card flat bordered class="seller-detail-panel bg-white q-pa-md text-center">
              <q-icon name="point_of_sale" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ money(seller?.sale_total) }}</div>
              <div class="text-caption text-grey-7">Ventas Int.</div>
            </q-card>
          </div>
        </div>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Resumen financiero</div>
        <q-card flat bordered class="seller-detail-panel bg-white">
          <q-list separator>
            <q-item v-for="item in financialItems" :key="item.label" class="q-px-md q-py-sm">
              <q-item-section>{{ item.label }}</q-item-section>
              <q-item-section side class="text-weight-bold text-dark">
                <q-badge
                  v-if="item.highlight"
                  color="yellow-9"
                  text-color="dark"
                  class="q-px-sm q-py-xs text-weight-bold"
                >
                  {{ money(item.value) }}
                </q-badge>
                <span v-else>{{ money(item.value) }}</span>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Bonus</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-card flat bordered class="seller-detail-panel bg-white q-pa-md">
              <div class="text-caption text-grey-7">Bonus</div>
              <div class="text-subtitle1 text-weight-bold q-mt-xs">{{ display(seller?.bonus) }}</div>
            </q-card>
          </div>
          <div class="col-12 col-sm-6">
            <q-card flat bordered class="seller-detail-panel bg-yellow-1 q-pa-md">
              <div class="text-caption text-grey-8">Monto de bonus</div>
              <div class="text-subtitle1 text-weight-bold q-mt-xs">{{ money(bonusAmount) }}</div>
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right" class="q-px-lg q-py-md bg-white">
        <q-btn unelevated color="yellow-9" text-color="dark" icon="close" label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "SellerDetailDialog",
  props: {
    modelValue: { type: Boolean, default: false },
    seller: { type: Object, default: null },
  },
  emits: ["update:modelValue"],
  computed: {
    financialItems() {
      return [
        { label: "Ingreso por perfumes", value: this.seller?.perfume_money_pay },
        { label: "Total vendido", value: this.seller?.total_sale },
        { label: "Efectivo", value: this.seller?.cash_total },
        { label: "Transferencia", value: this.seller?.transfer_total },
        { label: "Mensajería", value: this.seller?.money_delivery },
        { label: "Neto", value: this.seller?.net_total, highlight: true },
      ];
    },
    bonusAmount() {
      return this.seller?.bonusAmount ?? this.seller?.bonus_amount ?? this.seller?.bonusAMount;
    },
  },
  methods: {
    isFormatted(value) {
      return typeof value === "string" && /[a-záéíóúñ$]/i.test(value);
    },
    quantity(value) {
      if (this.isFormatted(value)) return value;
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(number)
        : "—";
    },
    average(value) {
      if (this.isFormatted(value)) return value;
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(number)
        : "—";
    },
    money(value) {
      if (this.isFormatted(value)) return value;
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(number)
        : "—";
    },
    display(value) {
      return value === null || value === undefined || value === "" ? "—" : value;
    },
  },
};
</script>

<style scoped>
.seller-detail-dialog {
  width: min(760px, 94vw);
  height: min(760px, calc(100vh - 32px));
  border-radius: 18px;
}

.seller-detail-dialog--mobile {
  height: calc(100vh - 32px);
  border-radius: 18px;
}

.seller-detail-panel {
  border-radius: 14px;
}
</style>
