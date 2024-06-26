import RefreshIcon from "@material-ui/icons/Refresh";
import { LinearProgress } from "@material-ui/core";
import { appSyncRequestMutation, appSyncRequestQuery } from "assets/js/request";
import { AmplifyConfigType } from "assets/js/type";
import Alert from "components/Alert";
import { AlertType } from "components/Alert/alert";
import Breadcrumb from "components/Breadcrumb";
import Button from "components/Button";
import FormItem from "components/FormItem";
import HeaderPanel from "components/HeaderPanel";
import Modal from "components/Modal";
import MultiSelect from "components/MultiSelect";
import { updateDomains } from "graphql/mutations";
import { listDistribution } from "graphql/queries";
import moment from "moment";
import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import Select from "react-select";
import { AppStateProps } from "reducer/appReducer";
import DateRangePicker from "rsuite/DateRangePicker";
import "rsuite/dist/rsuite.min.css";

const CloudFront: React.FC = () => {
  const { t } = useTranslation();
  const BreadCrunbList = [
    {
      name: t("name"),
      link: "/",
    },
    {
      name: t("monitor:name"),
      link: "",
    },
  ];

  const { afterToday } = DateRangePicker;
  const [cloudFrontList, setCloudFrontList] = useState<any[]>([]);
  const [selectDistribution, setSelectDistribution] = useState<any>([]);
  const [selectDistributionName, setSelectDistributionName] = useState<any>([]);
  const [openModal, setOpenModal] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectDomain, setSelectDomain] = useState("");
  const [showProgress, setShowProgress] = useState(true);
  const [progress, setProgress] = React.useState(0);

  const [cdnRequestData, setCdnRequestData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnRequestOriginData, setCdnRequestOriginData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnStatusCodeData, setCdnStatusCodeData] = useState([
    { Time: "", Value: [{ StatusCode: 0, Count: 0 }] },
  ]);
  const [cdnStatusCodeOriginData, setCdnStatusCodeOriginData] = useState([
    { Time: "", Value: [{ StatusCode: 0, Count: null }] },
  ]);
  const [cdnChrData, setCdnChrData] = useState([{ Time: "", Value: null }]);
  const [cdnChrBandWidthData, setCdnChrBandWidthData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnBandWidthData, setCdnBandWidthData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnBandWidthOriginData, setCdnBandWidthOriginData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnLatencyRatioData, setCdnLatencyRatioData] = useState([
    { Time: "", Value: null },
  ]);
  const [cdnDownloadSpeedData, setCdnDownloadSpeedData] = useState([
    { Time: "", Value: {} },
  ]);
  const [cdnDownloadSpeedOriginData, setCdnDownloadSpeedOriginData] = useState([
    { Time: "", Value: {} },
  ]);
  const [cdnTopNUrlRequestsData, setCdnTopNUrlRequestsData] = useState([
    { Time: "", Value: [{ Path: "", Count: null }] },
  ]);
  const [cdnTopNUrlSizeData, setCdnTopNUrlSizeData] = useState([
    { Time: "", Value: [{ Path: "", Size: null }] },
  ]);
  const [cdnDownstreamTrafficData, setCdnDownstreamTrafficData] = useState([
    { Time: "", Value: null },
  ]);
  const amplifyConfig: AmplifyConfigType = useSelector(
    (state: AppStateProps) => state.amplifyConfig
  );

  // Get Distribution List
  const getCloudfrontDistributionList = async () => {
    try {
      const resData = await appSyncRequestQuery(listDistribution);
      const Cloudfront_info_list: any[] = resData.data.listDistribution;
      const tmpDistributionList = [];
      const tmpSelectedList = [];
      const domainData = await appSyncRequestMutation(updateDomains, {
        stack_name: "",
        domains: "*",
      });
      const domainList: string[] = [];
      if (domainData.data.updateDomains.includes(",")) {
        const domains = domainData.data.updateDomains.split(",");
        for (const index in domains) {
          domainList.push(domains[index].trim());
        }
      } else {
        domainList.push(domainData.data.updateDomains.trim());
      }

      for (const cfdistlistKey in Cloudfront_info_list) {
        const cname =
          Cloudfront_info_list[cfdistlistKey].aliases.Quantity === 0
            ? ""
            : " | " + Cloudfront_info_list[cfdistlistKey].aliases.Items[0];
        if (
          domainList.includes(Cloudfront_info_list[cfdistlistKey].domainName) ||
          domainList.includes("ALL") ||
          domainList.includes("All") ||
          domainList.includes("all")
        ) {
          tmpSelectedList.push({
            label: Cloudfront_info_list[cfdistlistKey].domainName + cname,
            name: Cloudfront_info_list[cfdistlistKey].domainName + cname,
            value: Cloudfront_info_list[cfdistlistKey].domainName,
          });
        }
        tmpDistributionList.push({
          label: Cloudfront_info_list[cfdistlistKey].domainName + cname,
          name: Cloudfront_info_list[cfdistlistKey].domainName + cname,
          value: Cloudfront_info_list[cfdistlistKey].domainName,
        });
      }
      setCloudFrontList(tmpDistributionList);
      setSelectDistribution(tmpSelectedList);

      const selectList: any = [];
      for (const index in tmpSelectedList) {
        selectList.push(tmpSelectedList[index].value);
      }
      setSelectDistributionName(selectList);
    } catch (error) {
      console.error(error);
    }
  };

  const getChartData = async () => {
    if (selectDomain) {
      const metrics = [
        "request",
        "requestOrigin",
        "statusCode",
        "statusCodeOrigin",
        "chr",
        "chrBandWidth",
        "bandwidth",
        "bandwidthOrigin",
        "latencyratio",
        "downloadSpeed",
        "downloadSpeedOrigin",
        "topNUrlRequests",
        "topNUrlSize",
        "downstreamTraffic",
      ];
      let i = 1;
      metrics.forEach(async (m) => {
        setShowProgress(true);
        setProgress((i / metrics.length) * 100);
        i = i + 1;
        const timeStamp = new Date().getTime();
        const url2 = `${amplifyConfig.aws_monitoring_url}/metric?StartTime=${startDate}&EndTime=${endDate}&Metric=${m}&Domain=${selectDomain}&timestamp=${timeStamp}`;
        try {
          const response = await fetch(url2, {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "x-api-key": amplifyConfig.aws_monitoring_api_key,
            },
          });
          const data = await response.json();
          await data.Response.Data[0].CdnData.forEach(
            (item: { Metric: string; DetailData: [] }) => {
              if (item.Metric === "request") {
                setCdnRequestData(item.DetailData);
              } else if (item.Metric === "requestOrigin") {
                setCdnRequestOriginData(item.DetailData);
              } else if (item.Metric === "statusCode") {
                setCdnStatusCodeData(item.DetailData);
              } else if (item.Metric === "statusCodeOrigin") {
                setCdnStatusCodeOriginData(item.DetailData);
              } else if (item.Metric === "chr") {
                setCdnChrData(item.DetailData);
              } else if (item.Metric === "chrBandWidth") {
                setCdnChrBandWidthData(item.DetailData);
              } else if (item.Metric === "bandwidth") {
                setCdnBandWidthData(item.DetailData);
              } else if (item.Metric === "bandwidthOrigin") {
                setCdnBandWidthOriginData(item.DetailData);
              } else if (item.Metric === "latencyRatio") {
                setCdnLatencyRatioData(item.DetailData);
              } else if (item.Metric === "downloadSpeed") {
                setCdnDownloadSpeedData(item.DetailData);
              } else if (item.Metric === "downloadSpeedOrigin") {
                setCdnDownloadSpeedOriginData(item.DetailData);
              } else if (item.Metric === "topNUrlRequests") {
                setCdnTopNUrlRequestsData(item.DetailData);
              } else if (item.Metric === "topNUrlSize") {
                setCdnTopNUrlSizeData(item.DetailData);
              } else if (item.Metric === "downstreamTraffic") {
                setCdnDownstreamTrafficData(item.DetailData);
              }
            }
          );
        } catch (error) {
          console.error(error);
        }
        setShowProgress(false);
      });
    }
  };

  useEffect(() => {
    getChartData();
  }, [selectDomain, startDate, endDate]);

  useEffect(() => {
    getCloudfrontDistributionList();
    setStartDate(
      encodeURI(moment().utc().add(-12, "hours").format("YYYY-MM-DD HH:mm:ss"))
    );
    setEndDate(encodeURI(moment.utc(new Date()).format("YYYY-MM-DD HH:mm:ss")));
  }, []);

  const getCdnStatusCode = () => {
    const status: number[] = [];
    cdnStatusCodeData.map(function (element) {
      element.Value.map(function (obj) {
        if (!status.includes(obj.StatusCode)) {
          status.push(obj.StatusCode);
        }
      });
    });
    const series: { name: string; data: any[] }[] = [];
    status.map(function (code) {
      const data: any[] = [];
      cdnStatusCodeData.map(function (element) {
        let found = false;
        element.Value.map(function (obj) {
          if (code === obj.StatusCode) {
            data.push(obj.Count);
            found = true;
          }
        });
        if (!found) {
          data.push(null);
        }
      });
      series.push({
        name: code + "",
        data: data,
      });
    });
    return series;
  };

  const getCdnStatusCodeOrigin = () => {
    const status: number[] = [];
    cdnStatusCodeOriginData.map(function (element) {
      element.Value.map(function (obj) {
        if (!status.includes(obj.StatusCode)) {
          status.push(obj.StatusCode);
        }
      });
    });
    const series: { name: string; data: any[] }[] = [];
    status.map(function (code) {
      const data: any[] = [];
      cdnStatusCodeOriginData.map(function (element) {
        let found = false;
        element.Value.map(function (obj) {
          if (code === obj.StatusCode) {
            data.push(obj.Count);
            found = true;
          }
        });
        if (!found) {
          data.push(null);
        }
      });
      series.push({
        name: code + "",
        data: data,
      });
    });
    return series;
  };

  const getCdnTopNUrlRequestsData = () => {
    const topurl: string[] = [];
    cdnTopNUrlRequestsData.map(function (element) {
      element.Value.map(function (obj) {
        if (!topurl.includes(obj.Path)) {
          topurl.push(obj.Path);
        }
      });
    });
    const series: { name: string; data: any[] }[] = [];
    topurl.map(function (url) {
      const data: any[] = [];
      cdnTopNUrlRequestsData.map(function (element) {
        let found = false;
        element.Value.map(function (obj) {
          if (url === obj.Path) {
            data.push(obj.Count);
            found = true;
          }
        });
        if (!found) {
          data.push(null);
        }
      });
      series.push({
        name: url,
        data: data,
      });
    });
    return series;
  };

  const getCdnTopNUrlSizeData = () => {
    const topurl: string[] = [];
    cdnTopNUrlSizeData.map(function (element) {
      element.Value.map(function (obj) {
        if (!topurl.includes(obj.Path)) {
          topurl.push(obj.Path);
        }
      });
    });
    const series: { name: string; data: any[] }[] = [];
    topurl.map(function (url) {
      const data: any[] = [];
      cdnTopNUrlSizeData.map(function (element) {
        let found = false;
        element.Value.map(function (obj) {
          if (url === obj.Path) {
            data.push(obj.Size);
            found = true;
          }
        });
        if (!found) {
          data.push(null);
        }
      });
      series.push({
        name: url,
        data: data,
      });
    });
    return series;
  };

  const speedCategory: any[] = [];
  const getCdnDownloadSpeedData = () => {
    speedCategory.length = 0;
    const locations: string[] = [];
    const series: { name: string; data: any[] }[] = [];
    cdnDownloadSpeedData.map(function (element) {
      Object.entries(element.Value).forEach((obj) => {
        if (obj[0] !== "domain" && obj[0] !== "timestamp") {
          Object.entries(obj[1] as object).forEach((speed) => {
            const name = obj[0] + "(" + speed[0] + ")";
            if (!locations.includes(name)) {
              locations.push(name);
            }
          });
        }
      });
    });
    locations.map(function (locationName) {
      const speeds: any[] = [];
      cdnDownloadSpeedData.map(function (element) {
        Object.entries(element.Value).forEach((obj) => {
          if (obj[0] !== "domain" && obj[0] !== "timestamp") {
            Object.entries(obj[1] as object).forEach((speed) => {
              if (locationName === obj[0] + "(" + speed[0] + ")") {
                const sum: number =
                  speed[1]["250K"] * 250 +
                  speed[1]["750K"] * 750 +
                  speed[1]["500K"] * 500 +
                  speed[1]["250K"] * 250 +
                  speed[1]["1M"] * 1000 +
                  speed[1]["2M"] * 2000 +
                  speed[1]["3M"] * 3000 +
                  speed[1]["4M"] * 4000;
                speeds.push(sum);
                speedCategory.push(speed[1]);
              }
            });
          }
        });
      });
      series.push({
        name: locationName,
        data: speeds,
      });
    });
    return series;
  };

  const getCdnDownloadSpeedOriginData = () => {
    speedCategory.length = 0;
    const locations: string[] = [];
    const series: { name: string; data: any[] }[] = [];
    cdnDownloadSpeedOriginData.map(function (element) {
      Object.entries(element.Value).forEach((obj) => {
        if (obj[0] !== "domain" && obj[0] !== "timestamp") {
          Object.entries(obj[1] as object).forEach((speed) => {
            const name = obj[0] + "(" + speed[0] + ")";
            if (!locations.includes(name)) {
              locations.push(name);
            }
          });
        }
      });
    });
    locations.map(function (locationName) {
      const speeds: any[] = [];
      cdnDownloadSpeedOriginData.map(function (element) {
        Object.entries(element.Value).forEach((obj) => {
          if (obj[0] !== "domain" && obj[0] !== "timestamp") {
            Object.entries(obj[1] as object).forEach((speed) => {
              if (locationName === obj[0] + "(" + speed[0] + ")") {
                const sum: number =
                  speed[1]["250K"] * 250 +
                  speed[1]["750K"] * 750 +
                  speed[1]["500K"] * 500 +
                  speed[1]["250K"] * 250 +
                  speed[1]["1M"] * 1000 +
                  speed[1]["2M"] * 2000 +
                  speed[1]["3M"] * 3000 +
                  speed[1]["4M"] * 4000;
                speeds.push(sum);
                speedCategory.push(speed[1]);
              }
            });
          }
        });
      });
      series.push({
        name: locationName,
        data: speeds,
      });
    });
    return series;
  };

  const selectAllDistributions = () => {
    const selectList: any = [];
    for (const index in cloudFrontList) {
      selectList.push(cloudFrontList[index].value);
    }
    setSelectDistributionName(selectList);
    setSelectDistribution(selectList);
  };

  const selectNoneDistributions = async () => {
    setSelectDistributionName([]);
    setSelectDistribution([]);
  };

  const applyDomainList = async () => {
    try {
      setLoadingApply(true);
      await appSyncRequestMutation(updateDomains, {
        stack_name: amplifyConfig.aws_monitoring_stack_name,
        domains: selectDistribution,
      });
      await getCloudfrontDistributionList();
      setLoadingApply(false);
      setOpenModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <Breadcrumb list={BreadCrunbList} />
      {amplifyConfig.aws_monitoring_url === "" && (
        <Alert type={AlertType.Error} content={t("monitor:cloudfront.alert")} />
      )}
      {showProgress && (
        <LinearProgress variant="determinate" value={progress} />
      )}
      <HeaderPanel
        title={t("monitor:cloudFront.monitoring")}
        action={
          <div>
            <Button
              disabled={amplifyConfig.aws_monitoring_url === ""}
              btnType="primary"
              onClick={() => {
                setOpenModal(true);
              }}
            >
              {t("button.updateDomainList")}
            </Button>
          </div>
        }
      >
        <FormItem
          optionTitle={t("distributions")}
          optionDesc={<div>{t("monitor:cloudFront.chooseDistribution")}</div>}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 400px 50px",
              gridGap: 20,
            }}
          >
            <Select
              options={selectDistribution}
              isDisabled={amplifyConfig.aws_monitoring_url === ""}
              onChange={(event: any) => {
                if (event !== null) {
                  let domainName = event.value;
                  if (event.name.indexOf("|") > 0) {
                    domainName = event.name
                      .substring(event.name.indexOf("|") + 1)
                      .trim();
                  }
                  setSelectDomain(domainName);
                }
              }}
            />
            <DateRangePicker
              disabled={amplifyConfig.aws_monitoring_url === ""}
              format="yyyy-MM-dd HH:mm"
              defaultValue={[moment().add(-12, "hours").toDate(), new Date()]}
              disabledDate={afterToday?.()}
              onChange={(range) => {
                if (range !== null) {
                  setStartDate(
                    encodeURI(
                      moment.utc(range[0]).format("YYYY-MM-DD HH:mm:ss")
                    )
                  );
                  setEndDate(
                    encodeURI(
                      moment.utc(range[1]).format("YYYY-MM-DD HH:mm:ss")
                    )
                  );
                }
              }}
            />
            <Button
              disabled={amplifyConfig.aws_monitoring_url === ""}
              onClick={() => {
                getChartData();
              }}
            >
              <RefreshIcon fontSize="medium" />
            </Button>
          </div>
        </FormItem>
        <div className="flex flex-warp">
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnRequestData.map((element) => element.Time),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.request"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnRequestData.map((element) => element.Value),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnRequestOriginData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.requestOrigin"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnRequestOriginData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnStatusCodeData.map((element) => element.Time),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.statusCode"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={getCdnStatusCode()}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnStatusCodeOriginData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                legend: {
                  position: "top",
                  horizontalAlign: "right",
                  floating: true,
                  offsetY: -25,
                  offsetX: -5,
                },
                title: {
                  text: t("monitor:cloudFront.chart.statusCodeOrigin"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={getCdnStatusCodeOrigin()}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnChrData.map((element) => element.Time),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.cacheHitRate"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnChrData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnChrBandWidthData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.cacheHitRateBW"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnChrBandWidthData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnBandWidthData.map((element) => element.Time),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.bandWidth"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnBandWidthData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnBandWidthOriginData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.bandWidthOrigin"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnBandWidthOriginData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnLatencyRatioData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.latencyRatio"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnLatencyRatioData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
          {amplifyConfig.aws_monitoring_stack_name ===
            "RealtimeMonitoringStack" && (
            <div className="chart-item">
              <Chart
                options={{
                  xaxis: {
                    categories: cdnDownloadSpeedData.map(
                      (element) => element.Time
                    ),
                    labels: {
                      show: false,
                    },
                  },
                  title: {
                    text: t("monitor:cloudFront.chart.downloadSpeed"),
                  },
                  chart: {
                    height: 450,
                    type: "line",
                    zoom: {
                      enabled: false,
                    },
                    animations: {
                      enabled: false,
                    },
                    toolbar: {
                      show: false,
                      tools: {
                        download: false,
                      },
                    },
                  },
                  dataLabels: {
                    enabled: false,
                  },
                  stroke: {
                    width: 2,
                    curve: "smooth",
                  },
                  tooltip: {
                    custom: function ({ dataPointIndex }) {
                      return (
                        "<table>" +
                        "<tr><td>4M</td><td>" +
                        speedCategory[dataPointIndex]["4M"] +
                        "</td></tr>" +
                        "<tr><td>3M</td><td>" +
                        speedCategory[dataPointIndex]["3M"] +
                        "</td></tr>" +
                        "<tr><td>2M</td><td>" +
                        speedCategory[dataPointIndex]["2M"] +
                        "</td></tr>" +
                        "<tr><td>1M</td><td>" +
                        speedCategory[dataPointIndex]["1M"] +
                        "</td></tr>" +
                        "<tr><td>750K</td><td>" +
                        speedCategory[dataPointIndex]["750K"] +
                        "</td></tr>" +
                        "<tr><td>500K</td><td>" +
                        speedCategory[dataPointIndex]["500K"] +
                        "</td></tr>" +
                        "<tr><td>250K</td><td>" +
                        speedCategory[dataPointIndex]["250K"] +
                        "</td></tr>" +
                        "<tr><td>Other</td><td>" +
                        speedCategory[dataPointIndex]["Other"] +
                        "</td></tr>" +
                        "</table>"
                      );
                    },
                  },
                }}
                series={getCdnDownloadSpeedData()}
                type="line"
                width="90%"
              />
            </div>
          )}
          {amplifyConfig.aws_monitoring_stack_name ===
            "RealtimeMonitoringStack" && (
            <div className="chart-item">
              <Chart
                options={{
                  xaxis: {
                    categories: cdnDownloadSpeedOriginData.map(
                      (element) => element.Time
                    ),
                    labels: {
                      show: false,
                    },
                  },
                  title: {
                    text: t("monitor:cloudFront.chart.downloadSpeedOrigin"),
                  },
                  chart: {
                    height: 450,
                    type: "line",
                    zoom: {
                      enabled: false,
                    },
                    animations: {
                      enabled: false,
                    },
                    toolbar: {
                      show: false,
                      tools: {
                        download: false,
                      },
                    },
                  },
                  dataLabels: {
                    enabled: false,
                  },
                  stroke: {
                    width: 2,
                    curve: "smooth",
                  },
                  tooltip: {
                    custom: function ({ dataPointIndex }) {
                      return (
                        "<table>" +
                        "<tr><td>4M</td><td>" +
                        speedCategory[dataPointIndex]["4M"] +
                        "</td></tr>" +
                        "<tr><td>3M</td><td>" +
                        speedCategory[dataPointIndex]["3M"] +
                        "</td></tr>" +
                        "<tr><td>2M</td><td>" +
                        speedCategory[dataPointIndex]["2M"] +
                        "</td></tr>" +
                        "<tr><td>1M</td><td>" +
                        speedCategory[dataPointIndex]["1M"] +
                        "</td></tr>" +
                        "<tr><td>750K</td><td>" +
                        speedCategory[dataPointIndex]["750K"] +
                        "</td></tr>" +
                        "<tr><td>500K</td><td>" +
                        speedCategory[dataPointIndex]["500K"] +
                        "</td></tr>" +
                        "<tr><td>250K</td><td>" +
                        speedCategory[dataPointIndex]["250K"] +
                        "</td></tr>" +
                        "<tr><td>Other</td><td>" +
                        speedCategory[dataPointIndex]["Other"] +
                        "</td></tr>" +
                        "</table>"
                      );
                    },
                  },
                }}
                series={getCdnDownloadSpeedOriginData()}
                type="line"
                width="90%"
              />
            </div>
          )}
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnTopNUrlRequestsData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.topNUrlReq"),
                },
                tooltip: {
                  shared: true,
                  fixed: {
                    enabled: true,
                    offsetY: 200,
                  },
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={getCdnTopNUrlRequestsData()}
              type="line"
              width="90%"
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnTopNUrlSizeData.map((element) => element.Time),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.topNUrlSize"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={getCdnTopNUrlSizeData()}
            />
          </div>
          <div className="chart-item">
            <Chart
              options={{
                xaxis: {
                  categories: cdnDownstreamTrafficData.map(
                    (element) => element.Time
                  ),
                  labels: {
                    show: false,
                  },
                },
                title: {
                  text: t("monitor:cloudFront.chart.downStreamTraffic"),
                },
                chart: {
                  height: 450,
                  type: "line",
                  zoom: {
                    enabled: false,
                  },
                  animations: {
                    enabled: false,
                  },
                  toolbar: {
                    show: false,
                    tools: {
                      download: false,
                    },
                  },
                },
                dataLabels: {
                  enabled: false,
                },
                stroke: {
                  width: 2,
                  curve: "smooth",
                },
              }}
              series={[
                {
                  name: "Value",
                  data: cdnDownstreamTrafficData.map(function (item) {
                    return item.Value;
                  }),
                },
              ]}
              type="line"
              width="90%"
            />
          </div>
        </div>
      </HeaderPanel>
      <Modal
        title={t("monitor:cloudFront.updateDomainList")}
        isOpen={openModal}
        fullWidth={true}
        closeModal={() => {
          setOpenModal(false);
        }}
        actions={
          <div className="button-action no-pb text-right">
            <Button
              onClick={() => {
                setOpenModal(false);
              }}
            >
              {t("button.cancel")}
            </Button>
            <Button
              btnType="primary"
              loading={loadingApply}
              onClick={() => {
                applyDomainList();
              }}
            >
              {t("button.apply")}
            </Button>
          </div>
        }
      >
        <div className="gsui-modal-content">
          <FormItem
            optionTitle={t("distribution")}
            optionDesc={t("monitor:cloudFront.applyConfig")}
          >
            <div className="flex">
              <div style={{ width: 800 }}>
                <MultiSelect
                  optionList={cloudFrontList}
                  value={selectDistributionName}
                  placeholder={t("monitor:cloudFront.selectDistribution")}
                  onChange={(items) => {
                    setSelectDistribution(items);
                  }}
                />
              </div>
              <div className="ml-5">
                <Button
                  onClick={() => {
                    selectAllDistributions();
                  }}
                >
                  {t("button.selectAll")}
                </Button>
              </div>
              <div className="ml-5">
                <Button
                  onClick={() => {
                    selectNoneDistributions();
                  }}
                >
                  {t("button.clear")}
                </Button>
              </div>
            </div>
          </FormItem>
        </div>
      </Modal>
    </div>
  );
};

export default CloudFront;
