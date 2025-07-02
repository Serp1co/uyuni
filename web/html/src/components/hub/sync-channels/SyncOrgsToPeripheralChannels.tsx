// SyncOrgsToPeripheralChannel.tsx
import * as React from "react";

import { Button } from "components/buttons";
import { Dialog } from "components/dialog/Dialog";
import { TopPanel } from "components/panels";
import { SectionToolbar } from "components/section-toolbar/section-toolbar";
import { Column } from "components/table/Column";
import { SearchField } from "components/table/SearchField";
import { Table } from "components/table/Table";
import { showSuccessToastr, showWarningToastr } from "components/toastr";

import Network from "utils/network";

import { Channel, ChannelSyncProps, Org } from "../types";
import SyncChannelsSelection from "./sync-channels-selection";

type SyncPeripheralsProps = {
  peripheralId: number;
  peripheralFqdn: string;
  availableOrgs: Org[];
  channels: Channel[];
};

type State = {
  peripheralId: number;
  peripheralFqdn: string;
  channels: Channel[]; // Changed from FlatChannel[] to Channel[]
  availableOrgs: Org[];
  syncModalOpen: boolean;
  channelsToAdd: number[];
  channelsToRemove: number[];
  loading: boolean;
};

export class SyncOrgsToPeripheralChannel extends React.Component<SyncPeripheralsProps, State> {
  constructor(props: SyncPeripheralsProps) {
    super(props);

    // Pre-process channels
    const processedChannels = props.channels.map((channel) => {
      if (channel && channel.selectedPeripheralOrg !== null) {
        return { ...channel, strictOrg: true };
      }
      return channel;
    });

    this.state = {
      peripheralId: props.peripheralId,
      peripheralFqdn: props.peripheralFqdn,
      channels: processedChannels, // No flattening needed
      availableOrgs: props.availableOrgs,
      syncModalOpen: false,
      channelsToAdd: [],
      channelsToRemove: [],
      loading: false,
    };
  }

  componentDidUpdate(prevProps: SyncPeripheralsProps) {
    if (prevProps.channels !== this.props.channels) {
      this.setStateFromApiProps(this.props);
    }
  }

  private setStateFromApiProps(props: SyncPeripheralsProps) {
    const processedChannels = props.channels.map((channel) => {
      if (channel && channel.selectedPeripheralOrg !== null) {
        return { ...channel, strictOrg: true };
      }
      return channel;
    });

    this.setState({
      availableOrgs: props.availableOrgs,
      channels: processedChannels,
      loading: false,
      channelsToAdd: [],
      channelsToRemove: [],
    });
  }

  // Helper function to find a channel by ID in the hierarchical structure
  private findChannelById(channelId: number): Channel | undefined {
    const { channels } = this.state;

    for (const channel of channels) {
      if (channel.channelId === channelId) {
        return channel;
      }
      // Check children
      const childChannel = channel.children.find((child) => child.channelId === channelId);
      if (childChannel) {
        return childChannel;
      }
    }
    return undefined;
  }

  // Helper to get all channels as a flat list for modal display
  private getAllChannelsFlat(): Channel[] {
    const allChannels: Channel[] = [];

    const addChannel = (channel: Channel) => {
      allChannels.push(channel);
      channel.children.forEach((child) => addChannel(child));
    };

    this.state.channels.forEach((channel) => addChannel(channel));
    return allChannels;
  }

  handleChannelSelect = (channelId: number, checked: boolean) => {
    const { channelsToAdd, channelsToRemove } = this.state;
    const channel = this.findChannelById(channelId);
    if (!channel) return;
    const isChannelSynced = channel.synced;
    if (checked) {
      if (isChannelSynced) {
        if (channelsToRemove.includes(channelId)) {
          this.setState({
            channelsToRemove: channelsToRemove.filter((id) => id !== channelId),
          });
        }
      } else {
        if (!channelsToAdd.includes(channelId)) {
          this.setState({
            channelsToAdd: [...channelsToAdd, channelId],
          });
        }
      }
    } else {
      if (isChannelSynced) {
        if (!channelsToRemove.includes(channelId)) {
          this.setState({
            channelsToRemove: [...channelsToRemove, channelId],
          });
        }
      } else {
        if (channelsToAdd.includes(channelId)) {
          this.setState({
            channelsToAdd: channelsToAdd.filter((id) => id !== channelId),
          });
        }
      }
    }
  };

  handleOrgSelect = (channelId: number, org?: Org) => {
    this.setState((prevState) => ({
      channels: prevState.channels.map((channel) => {
        // Update root channel
        if (channel.channelId === channelId) {
          return {
            ...channel,
            selectedPeripheralOrg: org ?? null,
          };
        }
        // Update child channels
        return {
          ...channel,
          children: channel.children.map((child) => {
            if (child.channelId === channelId) {
              return {
                ...child,
                selectedPeripheralOrg: org ?? null,
              };
            }
            return child;
          }),
        };
      }),
    }));
  };

  onChannelSyncConfirm = () => {
    const { peripheralId, channelsToAdd, channelsToRemove } = this.state;

    if (channelsToAdd.length === 0 && channelsToRemove.length === 0) {
      showWarningToastr(t("No changes to apply"));
      return;
    }

    // Build the payload
    const channelsToAddByOrg: { orgId: number | null; channelLabels: string[] }[] = [];
    const orgGroups: Record<string, number[]> = {};

    channelsToAdd.forEach((id) => {
      const channel = this.findChannelById(id);
      if (!channel) return;

      const orgId = channel.selectedPeripheralOrg ? channel.selectedPeripheralOrg.orgId : null;
      const key = orgId === null ? "null" : orgId.toString();

      if (!orgGroups[key]) {
        orgGroups[key] = [];
      }
      orgGroups[key].push(id);
    });

    Object.entries(orgGroups).forEach(([orgKey, channelIds]) => {
      const orgId = orgKey === "null" ? null : parseInt(orgKey, 10);
      const channelLabels = channelIds.map((id) => this.findChannelById(id)?.channelLabel).filter(Boolean);

      if (channelLabels.length > 0) {
        channelsToAddByOrg.push({
          orgId,
          channelLabels,
        });
      }
    });

    const channelsToRemoveLabels = channelsToRemove.map((id) => this.findChannelById(id)?.channelLabel).filter(Boolean);

    const payload = {
      channelsToAdd: channelsToAddByOrg,
      channelsToRemove: channelsToRemoveLabels,
    };

    this.setState({ loading: true });

    const endpoint = `/rhn/manager/api/admin/hub/peripherals/${peripheralId}/sync-channels`;
    Network.post(endpoint, payload)
      .then(() => {
        showSuccessToastr(t("Channels synced correctly to peripheral!"));
        return Network.get(endpoint);
      })
      .then((response) => {
        const channelSync: ChannelSyncProps = JSON.parse(response);
        channelSync.channels.forEach((channel) => {
          if (channel.selectedPeripheralOrg !== null) {
            channel.strictOrg = true;
          }
        });

        const newProps = {
          peripheralId: this.props.peripheralId,
          peripheralFqdn: this.props.peripheralFqdn,
          availableOrgs: channelSync.peripheralOrgs,
          channels: channelSync.channels,
        };
        this.setStateFromApiProps(newProps);
        this.openCloseModalState(false);
      })
      .catch((error) => {
        Network.showResponseErrorToastr(error);
        this.setState({ loading: false });
        this.openCloseModalState(false);
      });
  };

  onChannelSyncModalOpen = () => {
    const { channelsToAdd, channelsToRemove } = this.state;
    if (channelsToAdd.length > 0 || channelsToRemove.length > 0) {
      this.openCloseModalState(true);
    } else {
      showWarningToastr(t("Please select at least one channel to add or remove from sync"));
    }
  };

  onChannelSyncModalClose = () => {
    this.openCloseModalState(false);
  };

  private openCloseModalState(isOpen: boolean) {
    this.setState({ syncModalOpen: isOpen });
  }

  render() {
    const { channels, syncModalOpen, availableOrgs, loading, channelsToAdd, channelsToRemove } = this.state;

    // Get flat list only for modal display
    const allChannels = this.getAllChannelsFlat();
    const channelsToAddData = allChannels.filter((channel) => channelsToAdd.includes(channel.channelId));
    const channelsToRemoveData = allChannels.filter((channel) => channelsToRemove.includes(channel.channelId));

    // Table renderers remain the same
    const renderChannelName = (channel: Channel) => <span>{channel.channelName}</span>;
    const renderChannelLabel = (channel: Channel) => <span>{channel.channelLabel}</span>;
    const renderChannelArch = (channel: Channel) => <span>{channel.channelArch}</span>;
    const renderChannelSyncOrg = (channel: Channel) => {
      if (channel.channelOrg === null) {
        return <span>Vendor</span>;
      }
      return <span>{channel.selectedPeripheralOrg ? channel.selectedPeripheralOrg.orgName : "Not set"}</span>;
    };

    const searchData = (row: Channel, criteria: string | undefined) => {
      const keysToSearch = ["channelName"];
      if (criteria) {
        const needle = criteria.toLocaleLowerCase();
        return keysToSearch.map((key) => row[key]).some((item) => item.toLocaleLowerCase().includes(needle));
      }
      return true;
    };

    // Modal content (same as before but using Channel type)
    const modalContent = (
      <>
        <h3>{t("Channel Sync Changes")}</h3>
        <p>{t("You are about to make the following changes:")}</p>

        {channelsToAddData.length > 0 && (
          <>
            <h4>{t("Channels to Add")}</h4>
            <Table
              data={channelsToAddData}
              identifier={(row: Channel) => row.channelId}
              selectable={false}
              initialSortColumnKey="channelName"
              searchField={<SearchField filter={searchData} placeholder={t("Filter by Name")} />}
            >
              <Column columnKey="channelName" header={t("Name")} cell={renderChannelName} />
              <Column columnKey="channelLabel" header={t("Label")} cell={renderChannelLabel} />
              <Column columnKey="channelArch" header={t("Arch")} cell={renderChannelArch} />
              <Column columnKey="orgName" header={t("Sync Org")} cell={renderChannelSyncOrg} />
            </Table>

            {channelsToAddData.some((channel) => channel.channelOrg && !channel.selectedPeripheralOrg) && (
              <div className="alert alert-warning">
                <span className="fa fa-exclamation-triangle"></span>{" "}
                {t("Some custom channels do not have a sync organization selected.")}
              </div>
            )}
          </>
        )}

        {channelsToRemoveData.length > 0 && (
          <>
            <h4>{t("Channels to Remove")}</h4>
            <Table
              data={channelsToRemoveData}
              identifier={(row: Channel) => row.channelId}
              selectable={false}
              initialSortColumnKey="channelName"
            >
              <Column columnKey="channelName" header={t("Name")} cell={renderChannelName} />
              <Column columnKey="channelLabel" header={t("Label")} cell={renderChannelLabel} />
              <Column columnKey="channelArch" header={t("Arch")} cell={renderChannelArch} />
              <Column columnKey="orgName" header={t("Sync Org")} cell={renderChannelSyncOrg} />
            </Table>
          </>
        )}
      </>
    );

    const modalFooter = (
      <div className="col-lg-12">
        <div className="pull-right btn-group">
          <Button
            id="sync-modal-cancel"
            className="btn-default"
            text={t("Cancel")}
            disabled={loading}
            handler={this.onChannelSyncModalClose}
          />
          <Button
            id="sync-modal-confirm"
            className="btn-primary"
            text={t("Confirm")}
            disabled={loading || (channelsToAdd.length === 0 && channelsToRemove.length === 0)}
            handler={this.onChannelSyncConfirm}
          />
        </div>
      </div>
    );

    return (
      <TopPanel
        title={t("{peripheralFqdn} - Peripheral Sync Channels", this.props)}
        icon="fa-cogs"
        helpUrl="reference/admin/hub/hub-details.html"
      >
        <SectionToolbar>
          <div className="selector-button-wrapper">
            <div className="btn-group pull-left">
              <Button
                className="btn-default"
                icon="fa-chevron-left"
                text={t("Back to details")}
                handler={() =>
                  window.pageRenderers?.spaengine?.navigate?.(
                    `/rhn/manager/admin/hub/peripherals/${this.props.peripheralId}`
                  )
                }
              />
            </div>
          </div>
          <div className="action-button-wrapper">
            <div className="btn-group pull-right">
              <Button
                className="btn-primary"
                title={t("Apply Changes")}
                text={t("Apply Changes")}
                disabled={loading || (channelsToAdd.length === 0 && channelsToRemove.length === 0)}
                handler={this.onChannelSyncModalOpen}
              />
            </div>
          </div>
        </SectionToolbar>

        <SyncChannelsSelection
          channels={channels}
          availableOrgs={availableOrgs}
          onChannelSelect={this.handleChannelSelect}
          onOrgSelect={this.handleOrgSelect}
          loading={loading}
          channelsToAdd={channelsToAdd}
          channelsToRemove={channelsToRemove}
        />

        <Dialog
          id="sync-channel-modal"
          title={t("Confirm Channel Synchronization Changes")}
          content={modalContent}
          isOpen={syncModalOpen}
          footer={modalFooter}
          onClose={this.onChannelSyncModalClose}
        />
      </TopPanel>
    );
  }
}

export default SyncOrgsToPeripheralChannel;
