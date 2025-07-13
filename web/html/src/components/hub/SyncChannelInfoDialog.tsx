import * as React from "react";
import { useEffect, useState } from "react";

import { Button } from "components/buttons";
import { Dialog } from "components/dialog/Dialog";

import Network, { JsonResult } from "utils/network";

import { FlatChannel } from "./types";

type ChannelInfoModalProps = {
  isOpen: boolean;
  channel: FlatChannel | null;
  onClose: () => void;
};

export function reduceMandatoryIdMapToSet(obj: Record<number, number[]>): Set<number> {
  return new Set([...Object.keys(obj).map(Number), ...Object.values(obj).flat()]);
}

export function getMandatoryChannelsId(channelsId: number[]): Promise<any> {
  return Network.post("/rhn/manager/api/admin/mandatoryChannels", channelsId).then(
    (result: JsonResult<Record<number, Array<number>>>) => result.data
  );
}

export const SyncChannelInfoDialog: React.FC<ChannelInfoModalProps> = ({ isOpen, channel, onClose }) => {
  const [mandatoryChannels, setMandatoryChannels] = useState<Set<number>>();
  const [loadingMandatory, setLoadingMandatory] = useState(false);

  useEffect(() => {
    if (isOpen && channel) {
      setLoadingMandatory(true);
      getMandatoryChannelsId([channel.channelId])
        .then((data: Record<number, Array<number>>) => {
          setMandatoryChannels(reduceMandatoryIdMapToSet(data));
          setLoadingMandatory(false);
        })
        .catch(() => {
          setLoadingMandatory(false);
        });
    }
  }, [isOpen, channel]);

  const renderPeripheralOrg = () => {
    return channel?.channelOrg === null ? (
      <span className="text-info">{t("Vendor (No organization required)")}</span>
    ) : (
      <span className="text-warning">{t("Not set - Organization mapping required")}</span>
    );
  };

  const renderModalContent = () => {
    if (!channel) {
      return null;
    }

    return (
      <>
        <h3 className="mt-4">{t("Channel Information: {name}", { name: channel.channelName })}</h3>

        <div className="panel panel-default">
          <div className="panel-heading">
            <h4>{t("Basic Information")}</h4>
          </div>
          <div className="panel-body">
            <dl className="row">
              <dt className="col-sm-3">{t("Channel ID")}</dt>
              <dd className="col-sm-9">{channel.channelId}</dd>

              <dt className="col-sm-3">{t("Channel Name")}</dt>
              <dd className="col-sm-9">{channel.channelName}</dd>

              <dt className="col-sm-3">{t("Channel Label")}</dt>
              <dd className="col-sm-9">{channel.channelLabel}</dd>

              <dt className="col-sm-3">{t("Architecture")}</dt>
              <dd className="col-sm-9">{channel.channelArch}</dd>

              <dt className="col-sm-3">{t("Channel Type")}</dt>
              <dd className="col-sm-9">
                {channel.channelOrg === null ? <span>{t("Vendor Channel")}</span> : <span>{t("Custom Channel")}</span>}
              </dd>

              <dt className="col-sm-3">{t("Parent Channel")}</dt>
              <dd className="col-sm-9">
                {channel.parentChannelLabel ? <span>{channel.parentChannelLabel}</span> : <span>{t("None")}</span>}
              </dd>
            </dl>
          </div>
        </div>

        <div className="panel panel-default">
          <div className="panel-heading">
            <h4>{t("Organization Information")}</h4>
          </div>
          <div className="panel-body">
            <dl className="row">
              <dt className="col-sm-3">{t("Hub Organization")}</dt>
              <dd className="col-sm-9">
                {channel.channelOrg ? (
                  <>
                    {channel.channelOrg.orgName}
                    <span> ({channel.channelOrg.orgId})</span>
                  </>
                ) : (
                  <span className="text-info">{t("Vendor (No organization)")}</span>
                )}
              </dd>

              <dt className="col-sm-3">{t("Peripheral Sync Org")}</dt>
              <dd className="col-sm-9">
                {channel.selectedPeripheralOrg ? (
                  <>
                    {channel.selectedPeripheralOrg.orgName}
                    <span> ({channel.selectedPeripheralOrg.orgId})</span>
                  </>
                ) : (
                  renderPeripheralOrg()
                )}
              </dd>
            </dl>
          </div>
        </div>

        <div className="panel panel-default">
          <div className="panel-heading">
            <h4>{t("Sync Status")}</h4>
          </div>
          <div className="panel-body">
            <dl className="row">
              <dt className="col-sm-3">{t("Currently Synced")}</dt>
              <dd className="col-sm-9">
                {channel.synced ? (
                  <span className="label label-success">
                    <i className="fa fa-check"></i> {t("Synced")}
                  </span>
                ) : (
                  <span className="label label-default">
                    <i className="fa fa-times"></i> {t("Not Synced")}
                  </span>
                )}
              </dd>
            </dl>
          </div>
        </div>

        {/* Mandatory channels section */}
        <div className="panel panel-default">
          <div className="panel-heading">
            <h4>{t("Mandatory Channels")}</h4>
          </div>
          <div className="panel-body">
            {loadingMandatory && (
              <span>
                <i className="fa fa-spinner fa-spin"></i> {t("Loading mandatory channels...")}
              </span>
            )}

            {!loadingMandatory && mandatoryChannels && mandatoryChannels.size > 0 && (
              <pre>{JSON.stringify(Array.from(mandatoryChannels.values()))}</pre>
            )}
            {!loadingMandatory && mandatoryChannels && mandatoryChannels.size === 0 && (
              <pre>{t("No mandatory channels")}</pre>
            )}
          </div>
        </div>
      </>
    );
  };

  const modalFooter = (
    <div className="col-lg-12">
      <div className="pull-right">
        <Button id="info-modal-close" className="btn-default" text={t("Close")} handler={onClose} />
      </div>
    </div>
  );

  return (
    <Dialog
      id="info-channel-modal"
      title={t("Channel Information")}
      content={renderModalContent()}
      isOpen={isOpen}
      footer={modalFooter}
      onClose={onClose}
    />
  );
};

export default SyncChannelInfoDialog;
