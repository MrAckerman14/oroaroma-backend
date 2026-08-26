<template>
  <div class="col-12">

    <q-table
      flat
      bordered
      :rows="rows"
      :columns="columns"
      :filter="filter"
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
    >
      <template #top-right>
        <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar">
          <template #append><q-icon name="search" /></template>
        </q-input>
      </template>

      <!-- ========================= -->
      <!-- CUERPO -->
      <!-- ========================= -->

      <template
        v-slot:body="props"
      >
        <q-tr :props="props">

          <!-- NOMBRE -->

          <q-td
            key="name"
            :props="props"
          >
            {{ props.row?.name }}
          </q-td>

          <!-- CANTIDAD ENVÍOS -->

          <q-td
            key="count_delivery"
            :props="props"
          >
            {{ formatQuantity(props.row.count_delivery) }}
          </q-td>

          <!-- PROMEDIO -->

          <q-td
            key="average"
            :props="props"
          >
            {{ formatAverage(props.row.average) }}
          </q-td>

          <!-- CANTIDAD PERFUMES -->

          <q-td
            key="count_perfum"
            :props="props"
          >
            {{ formatQuantity(props.row.count_perfum) }}
          </q-td>

          <!-- EFECTIVO -->

          <q-td
            key="cash_total"
            :props="props"
          >
            {{ formatMoney(props.row.cash_total) }}
          </q-td>

          <!-- TRANSFERENCIA -->

          <q-td
            key="transfer_total"
            :props="props"
          >
            {{ formatMoney(props.row.transfer_total) }}
          </q-td>

          <!-- MENSAJERÍA -->

          <q-td
            key="money_delivery"
            :props="props"
          >
            {{ formatMoney(props.row.money_delivery) }}
          </q-td>

          <!-- NETO -->

          <q-td
            key="net_total"
            :props="props"
          >
            <q-badge color="yellow-9" text-color="dark" class="q-px-sm q-py-xs text-weight-bold">
              {{ formatMoney(props.row.net_total) }}
            </q-badge>
          </q-td>

          <!-- ========================= -->
          <!-- ACCIONES -->
          <!-- ========================= -->

          <q-td
            v-if="isAdmin"
            key="actions"
            :props="props"
          >

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
              @click="
                $emit(
                  'edit',
                  props.row
                )
              "
            />

            <q-btn
              round
              flat
              color="negative"
              icon="delete"
              @click="
                $emit(
                  'delete',
                  props.row
                )
              "
            />

          </q-td>

        </q-tr>
      </template>

    </q-table>

  </div>
</template>

<script>
export default {
  name: "UsersEmployeesTable",

  props: {
    rows: {
      type: Array,
      default: () => [],
    },

    columns: {
      type: Array,
      default: () => [],
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return { filter: "" };
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

    formatAverage(value) {
      if (this.isAlreadyFormatted(value)) return value;

      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", {
            style: "currency",
            currency: "DOP",
            maximumFractionDigits: 2,
          }).format(number)
        : "—";
    },

    formatMoney(value) {
      if (this.isAlreadyFormatted(value)) return value;

      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat("es-DO", {
            style: "currency",
            currency: "DOP",
          }).format(number)
        : "—";
    },
  },

  emits: ["edit", "delete", "view-details"],
};
</script>

<style scoped>
:deep(.q-table th), :deep(.q-table td) { text-align: center !important; }
</style>
