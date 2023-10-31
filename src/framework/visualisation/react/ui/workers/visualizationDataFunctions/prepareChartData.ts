import { formatDate, getTableColumn } from './util'
import { PropsUITable, TableContext } from '../../../../../types/elements'
import {
  TickerFormat,
  ChartVisualizationData,
  ChartVisualization
} from '../../../../../types/visualizations'

export async function prepareChartData (
  table: PropsUITable & TableContext,
  visualization: ChartVisualization
): Promise<ChartVisualizationData> {
  const visualizationData: ChartVisualizationData = {
    type: visualization.type,
    xKey: {
      label:
        visualization.group.label !== undefined
          ? visualization.group.label
          : visualization.group.column
    },
    yKeys: {},
    data: []
  }

  if (table.body.rows.length === 0) return visualizationData

  // First get the unique values of the x column
  const rowIds = table.body.rows.map((row) => row.id)

  let groupBy = getTableColumn(table, visualization.group.column)
  // KASPER CHECK: I think the first clause in the statement can go
  // getTableColumn will return a string array or errs out
  // so only check for length is still doing something
  if (groupBy.length === 0) {
    throw new Error(`X column ${table.id}.${visualization.group.column} not found`)
  }
  let xSortable: Array<string | number> | null = null // separate variable allows using epoch time for sorting dates

  // ADD CODE TO TRANSFORM TO DATE, BUT THEN ALSO KEEP AN INDEX BASED ON THE DATE ORDER
  if (visualization.group.dateFormat !== undefined) {
    ;[groupBy, xSortable] = formatDate(groupBy, visualization.group.dateFormat)
  }

  const aggregate: Record<string, PrepareAggregatedData> = {}
  for (const value of visualization.values) {
    const aggFun = value.aggregate !== undefined ? value.aggregate : 'count'
    let tickerFormat: TickerFormat = 'default'
    if (aggFun === 'pct' || aggFun === 'count_pct') tickerFormat = 'percent'

    const yValues = getTableColumn(table, value.column)
    // KASPER CHECK
    if (yValues.length === 0) throw new Error(`Y column ${table.id}.${value.column} not found`)

    // If group_by column is specified, the columns in the aggregated data will be the unique group_by columns
    const yGroup = value.group_by !== undefined ? getTableColumn(table, value.group_by) : null

    // if missing values should be treated as zero, we need to add the missing values after knowing all groups
    const addZeroes = value.addZeroes ?? false
    const groupSummary: Record<string, { n: number, sum: number }> = {}
    const uniqueGroups = new Set<string>([])

    for (let i = 0; i < groupBy.length; i++) {
      const xValue = groupBy[i]
      const yValue = yValues[i]
      const group =
        yGroup != null ? yGroup[i] : value.label !== undefined ? value.label : value.column
      if (addZeroes) uniqueGroups.add(group)
      const sortBy = xSortable != null ? xSortable[i] : groupBy[i]

      // calculate group summary statistics. This is used for the mean, pct and count_pct aggregations
      if (groupSummary[group] === undefined) groupSummary[group] = { n: 0, sum: 0 }
      if (aggFun === 'count_pct' || aggFun === 'mean') groupSummary[group].n += 1
      if (aggFun === 'pct') groupSummary[group].sum += Number(yValue) ?? 0

      // add the AxisSettings for the yKeys in this loop, because we need to get the unique group values from the data (if group_by is used)
      if (visualizationData.yKeys[group] === undefined) {
        visualizationData.yKeys[group] = {
          label: group,
          secondAxis: value.secondAxis !== undefined,
          tickerFormat
        }
      }

      if (aggregate[xValue] === undefined) {
        aggregate[xValue] = {
          sortBy: sortBy,
          rowIds: {},
          xLabel: visualizationData.xKey.label,
          xValue: String(xValue),
          values: {}
        }
      }
      if (aggregate[xValue].rowIds[group] === undefined) aggregate[xValue].rowIds[group] = []
      aggregate[xValue].rowIds[group].push(rowIds[i])

      if (aggregate[xValue].values[group] === undefined) aggregate[xValue].values[group] = 0
      if (aggFun === 'count' || aggFun === 'count_pct') aggregate[xValue].values[group] += 1
      if (aggFun === 'sum' || aggFun === 'mean' || aggFun === 'pct') {
        aggregate[xValue].values[group] += Number(yValue) ?? 0
      }
    }

    Object.keys(groupSummary).forEach((group) => {
      for (const xValue of Object.keys(aggregate)) {
        if (aggregate[xValue].values[group] === undefined) {
          if (addZeroes) aggregate[xValue].values[group] = 0
          else continue
        }
        if (aggFun === 'mean') {
          aggregate[xValue].values[group] =
            Number(aggregate[xValue].values[group]) / groupSummary[group].n
        }
        if (aggFun === 'count_pct') {
          aggregate[xValue].values[group] =
            (100 * Number(aggregate[xValue].values[group])) / groupSummary[group].n
        }
        if (aggFun === 'pct') {
          aggregate[xValue].values[group] =
            (100 * Number(aggregate[xValue].values[group])) / groupSummary[group].sum
        }
      }
    })
  }

  visualizationData.data = Object.values(aggregate)
    .sort((a: any, b: any) => (a.sortBy < b.sortBy ? -1 : b.sortBy < a.sortBy ? 1 : 0))
    .map((d) => {
      for (const key of Object.keys(d.values)) d.values[key] = Math.round(d.values[key] * 100) / 100
      return {
        ...d.values,
        [d.xLabel]: d.xValue,
        __rowIds: d.rowIds,
        __sortBy: d.sortBy
      }
    })

  return visualizationData
}

export interface PrepareAggregatedData {
  xLabel: string
  xValue: string
  values: Record<string, number>
  rowIds: Record<string, string[]>
  sortBy: number | string
}
