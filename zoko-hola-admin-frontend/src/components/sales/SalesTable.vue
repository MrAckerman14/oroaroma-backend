<template>
  <q-table
    flat
    bordered
    :rows="sales"
    :columns="columns"
    row-key="id"
    binary-state-sort
    :pagination="initialPagination"
    :rows-per-page-options="rowsPerPageOptions"
    :filter="filter"
  >
    <template v-slot:top-right>
      <q-input
        outlined
        dense
        debounce="300"
        v-model="filter"
        placeholder="Buscar"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
    </template>
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td key="createdAt" :props="props">
          {{ formatDate(props.row?.createdAt) }}
        </q-td>
        <q-td key="phone" :props="props">
          {{ props.row.phone }}
        </q-td>
        <q-td key="seller_id" :props="props">
          {{ props.row.seller_id ? props.row.seller_id : "Venta interna" }}
        </q-td>
        <q-td key="messenger_id" :props="props">
          {{ props.row.messenger_id }}
        </q-td>
        <q-td key="employee_id" :props="props">
          {{ props.row.employee_id }}
        </q-td>
        <q-td key="count_perfume" :props="props">
          {{ props.row.count_perfume }}
        </q-td>
        <q-td key="state" :props="props">
          <q-badge color="green" v-show="props.row.state == 'Finalizado'">
            {{ props.row.state }}
          </q-badge>
          <q-badge color="red" v-show="props.row.state == 'Cancelado'">
            {{ props.row.state }}
          </q-badge>
          <q-badge color="amber" v-show="props.row.state == 'Pendiente'">
            Pendiente
          </q-badge>
        </q-td>
        <q-td key="amount_cash" :props="props">
          <span>{{ moneyFormat(props.row.amount_cash) }}</span>
        </q-td>
        <q-td key="amount_transfer" :props="props">
          <span>{{ moneyFormat(props.row.amount_transfer) }}</span>
        </q-td>
        <q-td key="amount" :props="props">
          <span class="text-bold">{{ moneyFormat(props.row?.amount) }}</span>
        </q-td>
        <q-td key="delivery_pay" :props="props">
          <span class="text-bold">{{
            moneyFormat(props.row.delivery_pay)
          }}</span>
        </q-td>
        <q-td>
          <q-btn
            dense
            flat
            round
            icon="visibility"
            color="yellow-9"
            text-color="black"
            @click="$emit('view-details', props.row)"
          />
          <q-btn
            round
            flat
            color="yellow-9"
            icon="edit"
            @click="$emit('edit', props.row)"
            v-if="canEditSale(props.row)"
          />
          <q-btn
            round
            flat
            color="negative"
            icon="delete"
            @click="$emit('delete', props.row)"
            v-if="isAdmin"
          />
        </q-td>
      </q-tr>

    </template>
  </q-table>
</template>

<script>
export default {
  name: "SalesTable",
  props: {
    sales: { type: Array, required: true },
    products: { type: Array, default: () => [] },
    isAdmin: { type: Boolean, default: false },
    isSellerUser: { type: Boolean, default: false },
  },
  emits: ["edit", "delete", "view-details"],
  data() {
    return {
      filter: "",
      initialPagination: { rowsPerPage: 100 },
      rowsPerPageOptions: [5, 10, 25, 50, 100, 250, 500, 0],
      columns: [
        { name: "createdAt", label: "Fecha", field: "createdAt", align: "left", sortable: true },
        { name: "phone", label: "Contacto", field: "phone", align: "left", sortable: true },
        { name: "seller_id", label: "Vendedor", field: "seller_id", align: "left", sortable: true },
        { name: "messenger_id", label: "Mensajero", field: "messenger_id", align: "left", sortable: true },
        { name: "employee_id", label: "Depachador", field: "employee_id", align: "left", sortable: true },
        { name: "count_perfume", label: "Cantidad", field: "count_perfume", align: "left", sortable: true },
        { name: "state", label: "Estado", field: "state", align: "left", sortable: true },
        { name: "amount_cash", label: "Efectivo", field: "amount_cash", align: "left", sortable: true },
        { name: "amount_transfer", label: "Transferencia", field: "amount_transfer", align: "left", sortable: true },
        { name: "amount", label: "Total", field: "amount", align: "left", sortable: true },
        { name: "delivery_pay", label: "Envío", field: "delivery_pay", align: "left", sortable: true },
        { name: "", label: "Opciones", field: "", align: "left" },
      ],
    };
  },
  methods: {
    canEditSale(row) {
      if (this.isAdmin) return true;
      return row?.state === "Pendiente" && !this.isSellerUser;
    },
    moneyFormat(value) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(value || 0));
    },
    formatDate(dateString) {
      if (!dateString) return "---";

      const date = new Date(dateString);

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isSameDay(date, today)) return "Hoy";
      if (isSameDay(date, yesterday)) return "Ayer";

      return date.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
  },
};
</script>

<style scoped>
:deep(.q-table th), :deep(.q-table td) { text-align: center !important; }
</style>
