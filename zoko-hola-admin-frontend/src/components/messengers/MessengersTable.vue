<template>
  <div class="col-12">
    <q-table
      flat
      bordered
      :rows="rows"
      :columns="columns"
      :filter="filter"
      row-key="name"
      binary-state-sort
      :pagination="{ rowsPerPage: 100 }"
      :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"
    >
      <template #top-right>
        <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar">
          <template #append><q-icon name="search" /></template>
        </q-input>
      </template>
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="name" :props="props">
            {{ props.row?.name }}
          </q-td>
          <q-td key="count_delivery" :props="props">
            {{ props.row.count_delivery }}
          </q-td>
          <q-td v-if="showEarnedMoney" key="delivery_pay" :props="props">
            <span class="text-bold">
              {{ moneyFormat(props.row.delivery_pay) }}
            </span>
          </q-td>
          <q-td key="pending_delivery_pay" :props="props">
            <span class="text-bold">
              {{ moneyFormat(props.row.pending_delivery_pay) }}
            </span>
          </q-td>
          <q-td key="money_pending" :props="props">
            <span class="text-bold">
              {{ moneyFormat(props.row.money_pending) }}
            </span>
          </q-td>
          <q-td v-if="isAdmin">
            <q-btn
              round
              flat
              color="black"
              icon="visibility"
              aria-label="Ver detalle"
              @click="$emit('view-details', props.row)"
            />
            <q-btn
              round
              flat
              color="yellow-9"
              icon="edit"
              @click="$emit('edit', props.row)"
            />
            <q-btn
              round
              flat
              color="negative"
              icon="delete"
              @click="$emit('delete', props.row)"
            />
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script>
export default {
  name: "MessengersTable",
  props: {
    rows: {
      type: Array,
      required: true,
    },
    columns: {
      type: Array,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    showEarnedMoney: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["edit", "delete", "view-details"],
  data() {
    return { filter: "" };
  },
  methods: {
    moneyFormat(value) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(value || 0));
    },
  },
};
</script>

<style scoped>
:deep(.q-table th), :deep(.q-table td) { text-align: center !important; }
</style>
