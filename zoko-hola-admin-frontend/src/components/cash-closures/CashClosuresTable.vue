<template>
  <q-card>
    <q-table
      flat
      bordered
      :rows="closures"
      :columns="columns"
      row-key="id"
      :filter="filter"
      binary-state-sort
      :pagination="{ rowsPerPage: 100 }"
      :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"
    >
      <template v-slot:top-right>
        <q-input
          dense
          outlined
          debounce="300"
          v-model="filter"
          placeholder="Buscar"
        >
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>

      <!-- ========================= -->
      <!-- NETO -->
      <!-- ========================= -->

      <template v-slot:body-cell-net_total="props">
        <q-td
          :props="props"
          class="text-weight-bold"
        >
          {{ formatMoney(props.row.net_total) }}
        </q-td>
      </template>

      <!-- ========================= -->
      <!-- ESTADO -->
      <!-- ========================= -->

      <template v-slot:body-cell-status="props">
        <q-td :props="props">
          <q-select
            dense
            outlined
            emit-value
            map-options
            :options="statusOptions"
            v-model="props.row.status"
            @update:model-value="
              $emit('change-status', props.row)
            "
            :disable="
              props.row.status === 'Anulado'
            "
            style="min-width: 120px"
          />
        </q-td>
      </template>

      <!-- ========================= -->
      <!-- ACCIONES -->
      <!-- ========================= -->

      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <!-- VER -->
          <q-btn
            flat
            dense
            icon="visibility"
            color="yellow-9"
            text-color="black"
            @click="$emit('open', props.row.id)"
          />

          <!-- EDITAR -->
          <q-btn
            round
            flat
            icon="edit"
            color="yellow-9"
            @click="$emit('edit', props.row)"
          />

          <!-- ELIMINAR -->
          <q-btn
            round
            flat
            icon="delete"
            color="negative"
            @click="$emit('delete', props.row)"
          />
        </q-td>
      </template>
    </q-table>
  </q-card>
</template>

<script>
export default {
  name: "CashClosuresTable",

  props: {
    closures: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    const formatMoney = (v) =>
      new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(v || 0));

    return {
      filter: "",

      statusOptions: [
        "Pendiente",
        "Verificado",
        "Anulado",
      ],

      columns: [
        {
          name: "name",
          label: "Nombre",
          field: "name",
          align: "center",
          sortable: true,
        },

        {
          name: "total_sale",
          label: "Total",
          field: "total_sale",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "total_cash",
          label: "Efectivo",
          field: "total_cash",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "total_trans",
          label: "Transferencia",
          field: "total_trans",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "total_messenger_cost",
          label: "Mensajería",
          field: "total_messenger_cost",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "net_total",
          label: "Neto",
          field: "net_total",
          align: "center",
          format: formatMoney,
          sortable: true,
        },

        {
          name: "total_perfumes",
          label: "Perfumes",
          field: "total_perfumes",
          align: "center",
          sortable: true,
        },

        {
          name: "status",
          label: "Estado",
          field: "status",
          align: "center",
          sortable: true,
        },

        {
          name: "actions",
          label: "Opciones",
          field: "id",
          align: "center",
        },
      ],
    };
  },

  methods: {
    formatMoney(v) {
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(v || 0));
    },
  },
};
</script>
