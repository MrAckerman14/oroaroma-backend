<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="messenger-detail-dialog column no-wrap" :class="{ 'messenger-detail-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="local_shipping" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Detalle del mensajero</div>
          <div class="text-caption text-grey-7">Informacion, entregas y balance pendiente.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <q-card flat bordered class="messenger-detail-panel q-pa-md bg-white">
          <div class="row items-center no-wrap">
            <q-avatar size="52px" color="grey-9" text-color="yellow-9" icon="person" />
            <div class="col q-ml-md">
              <div class="text-subtitle1 text-weight-bold">{{ messenger?.name || 'Sin nombre' }}</div>
              <div class="text-caption text-grey-7 ellipsis">{{ messenger?.email || 'Sin correo registrado' }}</div>
            </div>
            <q-badge outline color="grey-8">{{ messenger?.rol || 'Mensajero' }}</q-badge>
          </div>
        </q-card>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Resumen de entregas</div>
        <div class="row q-col-gutter-md">
          <div v-for="item in summaryItems" :key="item.label" class="col-12 col-sm-4">
            <q-card flat bordered class="messenger-detail-panel bg-white q-pa-md text-center">
              <q-icon :name="item.icon" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ item.money ? money(item.value) : quantity(item.value) }}</div>
              <div class="text-caption text-grey-7">{{ item.label }}</div>
            </q-card>
          </div>
        </div>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Balance</div>
        <q-card flat bordered class="messenger-detail-panel bg-white">
          <q-list separator>
            <q-item class="q-px-md q-py-sm">
              <q-item-section>Dinero ganado</q-item-section>
              <q-item-section side class="text-weight-bold text-dark"><q-badge color="yellow-9" text-color="dark" class="q-px-sm q-py-xs text-weight-bold">{{ money(messenger?.delivery_pay) }}</q-badge></q-item-section>
            </q-item>
          </q-list>
        </q-card>
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
  name: 'MessengerDetailDialog',
  props: { modelValue: { type: Boolean, default: false }, messenger: { type: Object, default: null } },
  emits: ['update:modelValue'],
  computed: {
    summaryItems() {
      return [
        { label: 'Envios completados', icon: 'local_shipping', value: this.messenger?.count_delivery },
        { label: 'Dinero pendiente', icon: 'account_balance_wallet', value: this.messenger?.money_pending, money: true },
        { label: 'Pago pendiente', icon: 'pending_actions', value: this.messenger?.pending_delivery_pay, money: true },
      ];
    },
  },
  methods: {
    isFormatted(value) { return typeof value === 'string' && /[a-záéíóúñ$]/i.test(value); },
    quantity(value) {
      if (this.isFormatted(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(parsed) : '—';
    },
    money(value) {
      if (this.isFormatted(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(parsed) : '—';
    },
  },
};
</script>

<style scoped>
.messenger-detail-dialog { width: min(760px, 94vw); height: min(720px, calc(100vh - 32px)); border-radius: 18px; }
.messenger-detail-dialog--mobile { height: calc(100vh - 32px); border-radius: 18px; }
.messenger-detail-panel { border-radius: 14px; }
</style>
