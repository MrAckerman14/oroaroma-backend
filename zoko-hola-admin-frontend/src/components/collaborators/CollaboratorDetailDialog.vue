<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="collaborator-detail-dialog column no-wrap" :class="{ 'collaborator-detail-dialog--mobile': $q.screen.lt.sm }">
      <q-card-section class="row items-center no-wrap q-px-lg q-py-md bg-white">
        <q-avatar color="yellow-9" text-color="dark" icon="handshake" />
        <div class="q-ml-md">
          <div class="text-h6 text-weight-bold">Detalle del colaborador</div>
          <div class="text-caption text-grey-7">Información personal, actividad y balance.</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense aria-label="Cerrar" @click="$emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="col scroll bg-grey-1 q-pa-lg">
        <q-card flat bordered class="collaborator-detail-panel q-pa-md bg-white">
          <div class="row items-center no-wrap">
            <q-avatar size="52px" color="grey-9" text-color="yellow-9" icon="person" />
            <div class="col q-ml-md">
              <div class="text-subtitle1 text-weight-bold">{{ collaborator?.name || "Sin nombre" }}</div>
              <div class="text-caption text-grey-7 ellipsis">{{ collaborator?.email || "Sin correo registrado" }}</div>
            </div>
            <q-badge outline color="grey-8">{{ collaborator?.rol || "Colaborador" }}</q-badge>
          </div>
        </q-card>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Actividad</div>
        <div class="row q-col-gutter-md">
          <div v-for="item in activityItems" :key="item.label" class="col-6 col-sm-3">
            <q-card flat bordered class="collaborator-detail-panel bg-white q-pa-md text-center">
              <q-icon :name="item.icon" color="grey-7" size="22px" />
              <div class="text-h6 text-weight-bold q-mt-xs">{{ item.format === 'money' ? money(item.value) : number(item.value) }}</div>
              <div class="text-caption text-grey-7">{{ item.label }}</div>
            </q-card>
          </div>
        </div>

        <div class="text-subtitle1 text-weight-bold q-mt-lg q-mb-sm">Balance financiero</div>
        <q-card flat bordered class="collaborator-detail-panel bg-white">
          <q-list separator>
            <q-item v-for="item in financialItems" :key="item.label" class="q-px-md q-py-sm">
              <q-item-section>{{ item.label }}</q-item-section>
              <q-item-section side class="text-weight-bold text-dark">
                <q-badge v-if="item.highlight" color="yellow-9" text-color="dark" class="q-px-sm q-py-xs text-weight-bold">{{ money(item.value) }}</q-badge>
                <span v-else>{{ money(item.value) }}</span>
              </q-item-section>
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
  name: "CollaboratorDetailDialog",
  props: { modelValue: { type: Boolean, default: false }, collaborator: { type: Object, default: null } },
  emits: ["update:modelValue"],
  computed: {
    activityItems() {
      return [
        { label: "Envíos", icon: "local_shipping", value: this.collaborator?.count_delivery },
        { label: "Perfumes", icon: "inventory_2", value: this.collaborator?.count_perfum },
        { label: "Promedio", icon: "trending_up", value: this.collaborator?.average },
        { label: "Pendiente", icon: "pending_actions", value: this.collaborator?.amount_pending, format: "money" },
      ];
    },
    financialItems() {
      return [
        { label: "Venta total", value: this.collaborator?.cash_perfume },
        { label: "Envío", value: this.collaborator?.money_delivery },
        { label: "Costo perfumes", value: this.collaborator?.perfume_money_pay },
        { label: "Ganancias Colaborador", value: this.netAmount, highlight: true },
      ];
    },
    netAmount() {
      return this.collaborator?.cash_net ?? (Number(this.collaborator?.cash_perfume || 0) - Number(this.collaborator?.money_delivery || 0) - Number(this.collaborator?.perfume_money_pay || 0));
    },
  },
  methods: {
    isFormatted(value) { return typeof value === "string" && /[a-záéíóúñ$]/i.test(value); },
    number(value) {
      if (this.isFormatted(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(parsed) : "—";
    },
    money(value) {
      if (this.isFormatted(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(parsed) : "—";
    },
  },
};
</script>

<style scoped>
.collaborator-detail-dialog { width: min(760px, 94vw); height: min(760px, calc(100vh - 32px)); border-radius: 18px; }
.collaborator-detail-dialog--mobile { height: calc(100vh - 32px); border-radius: 18px; }
.collaborator-detail-panel { border-radius: 14px; }
</style>
