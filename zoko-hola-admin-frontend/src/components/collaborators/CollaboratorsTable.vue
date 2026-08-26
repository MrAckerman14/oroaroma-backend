<template>
  <q-table
    flat
    bordered
    :rows="rows"
    :columns="columns"
    :filter="filter"
    row-key="id"
    binary-state-sort
    :pagination="{ rowsPerPage: 100 }"
    :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"
  >
    <template #top-right>
      <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar">
        <template #append><q-icon name="search" /></template>
      </q-input>
    </template>

    <template #body="props">
      <q-tr :props="props">
        <q-td key="name" :props="props">{{ props.row.name }}</q-td>
        <q-td key="cash_perfume" :props="props">{{ formatMoney(props.row.cash_perfume) }}</q-td>
        <q-td key="money_delivery" :props="props">{{ formatMoney(props.row.money_delivery) }}</q-td>
        <q-td key="perfume_money_pay" :props="props">{{ formatMoney(props.row.perfume_money_pay) }}</q-td>
        <q-td key="cash_net" :props="props">
          <q-badge color="yellow-9" text-color="dark" class="q-px-sm q-py-xs text-weight-bold">
            {{ formatMoney(cashNet(props.row)) }}
          </q-badge>
        </q-td>
        <q-td key="count_perfum" :props="props">{{ formatQuantity(props.row.count_perfum) }}</q-td>
        <q-td key="deliveriesCount" :props="props">{{ formatQuantity(deliveriesCount(props.row)) }}</q-td>
        <q-td key="actions" :props="props">
          <q-btn round flat color="black" icon="visibility" aria-label="Ver detalle" @click="$emit('view-details', props.row)" />
          <q-btn round flat color="yellow-9" icon="edit" aria-label="Editar" @click="$emit('edit', props.row)" />
          <q-btn round flat color="negative" icon="delete" aria-label="Eliminar" @click="$emit('delete', props.row)" />
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script>
export default {
  name: "CollaboratorsTable",
  props: {
    rows: { type: Array, default: () => [] },
  },
  emits: ["edit", "delete", "view-details"],
  data() {
    return {
      filter: "",
      columns: [
        { name: "name", required: true, label: "Nombre", field: "name", align: "left", sortable: true },
        { name: "cash_perfume", label: "Venta total", field: "cash_perfume", align: "left", sortable: true },
        { name: "money_delivery", label: "Envío", field: "money_delivery", align: "left", sortable: true },
        { name: "perfume_money_pay", label: "Costo perfumes", field: "perfume_money_pay", align: "left", sortable: true },
        { name: "cash_net", label: "Ganancias", field: (row) => this.cashNet(row), align: "left", sortable: true },
        { name: "count_perfum", label: "Total perfumes", field: "count_perfum", align: "left", sortable: true },
        { name: "deliveriesCount", label: "Total envíos", field: (row) => this.deliveriesCount(row), align: "left", sortable: true },
        { name: "actions", label: "Opciones", field: "actions", align: "left" },
      ],
    };
  },
  methods: {
    isAlreadyFormatted(value) {
      return typeof value === "string" && /[a-záéíóúñ$]/i.test(value);
    },
    formatQuantity(value) {
      if (this.isAlreadyFormatted(value)) return value;
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(number)
        : "—";
    },
    formatMoney(value) {
      if (this.isAlreadyFormatted(value)) return value;
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(number)
        : "—";
    },
    deliveriesCount(row) {
      return row?.deliveriesCount ?? row?.count_delivery;
    },
    cashNet(row) {
      return Number(row?.cash_perfume || 0) - Number(row?.money_delivery || 0) - Number(row?.perfume_money_pay || 0);
    },
  },
};
</script>

<style scoped>
:deep(.q-table th), :deep(.q-table td) { text-align: center !important; }
</style>
