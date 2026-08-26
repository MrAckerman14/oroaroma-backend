<template>
  <q-dialog v-model="dialog" maximized persistent>
    <q-card class="bg-grey-1">

      <!-- HEADER -->
      <q-bar class="bg-yellow-9 text-black">
        <div class="text-h6">📊 Cierre #{{ data?.closure?.id }}</div>
        <q-space/>
        <q-btn dense flat icon="close" @click="dialog=false"/>
      </q-bar>

      <q-card-section class="q-pb-none">
        <q-input v-model="filter" dense outlined debounce="300" placeholder="Buscar en el cierre">
          <template #append><q-icon name="search" /></template>
        </q-input>
      </q-card-section>

      <!-- TOTALES -->
      <q-card-section class="row q-col-gutter-md">
        <q-card v-for="t in totalsCards" :key="t.label" class="col-2 text-center">
          <div class="text-caption">{{ t.label }}</div>
          <div class="text-h6">RD$ {{ format(t.value) }}</div>
        </q-card>
      </q-card-section>

      <!-- MENSAJEROS -->
      <q-card-section>
        <div class="text-bold q-mb-sm">Mensajeros</div>
        <q-table flat dense :rows="data.messengers" :columns="messengerCols" :filter="filter" row-key="messenger_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"/>
      </q-card-section>

      <!-- COLABORADORES -->
      <q-card-section>
        <div class="text-bold q-mb-sm">Colaboradores</div>
        <q-table flat dense :rows="data.sellers" :columns="sellerCols" :filter="filter" row-key="seller_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"/>
      </q-card-section>

      <!-- VENDEDORES -->
      <q-card-section>
        <div class="text-bold q-mb-sm">Vendedores</div>
        <q-table flat dense :rows="data.employees" :columns="employeeCols" :filter="filter" row-key="employee_id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"/>
      </q-card-section>

      <!-- VENTAS -->
      <q-card-section>
        <div class="text-bold q-mb-sm">Ventas incluidas</div>
        <q-table flat bordered :rows="data.sales" :columns="saleCols" :filter="filter" row-key="id" :pagination="{ rowsPerPage: 100 }" :rows-per-page-options="[5, 10, 25, 50, 100, 250, 500, 0]"/>
      </q-card-section>

    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { api } from 'boot/axios'

const dialog = ref(false)
const closureId = ref(null)
const filter = ref('')

function show(id) {
  closureId.value = id
   dialog.value = true
  loadData()
}

defineExpose({ show })

const format = v => new Intl.NumberFormat('es-DO').format(v || 0)

const totalsCards = computed(() => [
  { label:'Bruto', value:data.value?.totals?.total_sale },
  { label:'Efectivo', value:data.value?.totals?.total_cash },
  { label:'Transfer', value:data.value?.totals?.total_trans },
  { label:'Mensajería', value:data.value?.totals?.total_messenger_cost },
  { label:'Neto', value:data.value?.totals?.net_total },
  { label:'Perfumes', value:data.value?.totals?.total_perfumes }
])

const messengerCols = [
  { name:'name', label:'Mensajero', field: r=>r['messenger.name'] },
  { name:'deliveries', label:'Envios', field:'deliveries', align:'center' },
  { name:'earned', label:'Dinero ganado', field:'earned', format },
  { name:'pending_delivery_pay', label:'Pago pendiente', field:'pending_delivery_pay', format },
  { name:'money_pending', label:'Dinero pendiente', field:'money_pending', format }
]

const sellerCols = [
  { name:'name', label:'Colaborador', field:r=>r['seller.name'] },
  { name:'sold', label:'Vendido', field:'sold', format },
  { name:'perfumes', label:'Perfumes', field:'perfumes' },
  { name:'delivery_cost', label:'Mensajería', field:'delivery_cost', format },
  { name:'shipments', label:'Envios', field:'shipments' }
]

const employeeCols = [
  { name:'name', label:'Vendedor', field:r=>r['employee.name'] },
  { name:'sold', label:'Vendido', field:'sold', format },
  { name:'orders', label:'Pedidos', field:'orders' }
]

const saleCols = [
  { name:'id', label:'#', field:'id' },
  { name:'employee', label:'Vendedor', field:r=>r.employee?.name },
  { name:'seller', label:'Colaborador', field:r=>r.seller?.name },
  { name:'messenger', label:'Mensajero', field:r=>r.messenger?.name },
  { name:'amount', label:'Monto', field:'amount', format },
  { name:'delivery_commission', label:'Mensajería', field:'delivery_commission', format }
]
</script>
