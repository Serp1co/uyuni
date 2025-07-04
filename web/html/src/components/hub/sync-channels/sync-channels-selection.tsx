import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import debounce from "lodash/debounce";

import { BaseChannelType, ChannelTreeType, ChildChannelType } from "core/channels/type/channels.type";

import { Column } from "components/table/Column";
import { SearchField } from "components/table/SearchField";
import { Table } from "components/table/Table";

import { Channel, Org } from "../types";
import SyncChannelProcessor from "./sync-channels-processor";

type FlatChannelRow = {
  id: number;
  name: string;
  label: string;
  archLabel: string;
  isChild: boolean;
  parentId: number | null;
  hasChildren: boolean;
  synced: boolean;
  custom: boolean;
};

type Props = {
  channels: Channel[];
  availableOrgs: Org[];
  onChannelSelect: (channelId: number, checked: boolean) => void;
  onOrgSelect: (channelId: number, org?: Org) => void;
  loading: boolean;
  channelsToAdd?: number[];
  channelsToRemove?: number[];
};

const SyncChannelsSelection = (props: Props) => {
  const [channelProcessor] = useState(new SyncChannelProcessor());
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set());
  const [syncedChannelIds, setSyncedChannelIds] = useState<Set<number>>(new Set());
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [searchValue, setSearchValue] = useState("");
  const [selectedArchs, setSelectedArchs] = useState<string[]>([]);

  // Convert hierarchical structure to flat array for Table component
  const flattenChannels = useCallback(
    (channels: Channel[]): FlatChannelRow[] => {
      const flatRows: FlatChannelRow[] = [];
      const rootChannels = channels.filter((ch) => !ch.parentChannelLabel);

      rootChannels.forEach((root) => {
        // Add root channel
        flatRows.push({
          id: root.channelId,
          name: root.channelName,
          label: root.channelLabel,
          archLabel: root.channelArch,
          isChild: false,
          parentId: null,
          hasChildren: root.children.length > 0,
          synced: root.synced,
          custom: root.channelOrg !== null,
        });

        // Add children if parent is open
        if (openRows.has(root.channelId)) {
          root.children.forEach((child) => {
            flatRows.push({
              id: child.channelId,
              name: child.channelName,
              label: child.channelLabel,
              archLabel: child.channelArch,
              isChild: true,
              parentId: root.channelId,
              hasChildren: false,
              synced: child.synced,
              custom: child.channelOrg !== null,
            });
          });
        }
      });

      return flatRows;
    },
    [openRows]
  );

  const getDistinctArchs = useCallback((channels: Channel[]) => {
    const archSet = new Set<string>();
    channels.forEach((channel) => {
      archSet.add(channel.channelArch);
      channel.children.forEach((child) => archSet.add(child.channelArch));
    });
    return Array.from(archSet).map((arch) => ({ value: arch, label: arch }));
  }, []);

  // Get filtered channels based on architecture
  const getFilteredChannels = useCallback((channels: Channel[], archFilter: string[]): Channel[] => {
    if (archFilter.length === 0) return channels;

    return channels
      .filter((channel) => {
        const baseMatches = archFilter.includes(channel.channelArch);
        const hasMatchingChild = channel.children.some((child) => archFilter.includes(child.channelArch));
        return baseMatches || hasMatchingChild;
      })
      .map((channel) => {
        if (archFilter.includes(channel.channelArch)) {
          return channel;
        }
        // Filter children if only they match
        return {
          ...channel,
          children: channel.children.filter((child) => archFilter.includes(child.channelArch)),
        };
      });
  }, []);

  // Process channels and set initial state
  useEffect(() => {
    channelProcessor.setAvailableOrgs(props.availableOrgs);

    const syncedIds = new Set<number>();
    const selectedIds = new Set<number>();

    const processChannel = (channel: Channel) => {
      channelProcessor.setSyncData(channel.channelId, {
        synced: channel.synced,
        selectedPeripheralOrg: channel.selectedPeripheralOrg,
        strictOrg: channel.strictOrg || false,
        channelOrg: channel.channelOrg,
      });

      if (channel.synced) {
        syncedIds.add(channel.channelId);
      }

      const isCurrentlySynced = channel.synced;
      const isPendingAddition = props.channelsToAdd?.includes(channel.channelId) || false;
      const isPendingRemoval = props.channelsToRemove?.includes(channel.channelId) || false;

      if ((isCurrentlySynced && !isPendingRemoval) || (!isCurrentlySynced && isPendingAddition)) {
        selectedIds.add(channel.channelId);
      }
    };

    props.channels.forEach((channel) => {
      processChannel(channel);
      channel.children.forEach((child) => processChannel(child));
    });

    setSyncedChannelIds(syncedIds);
    setSelectedChannelIds(selectedIds);

    // Open all rows initially
    const rootIds = props.channels.filter((ch) => !ch.parentChannelLabel).map((ch) => ch.channelId);
    setOpenRows(new Set(rootIds));
  }, [props.channels, props.availableOrgs, props.channelsToAdd, props.channelsToRemove]);

  const handleArchFilterChange = useCallback((_: string | undefined, selectedOptions: string | string[]) => {
    if (Array.isArray(selectedOptions)) {
      setSelectedArchs(selectedOptions);
    } else if (typeof selectedOptions === "string") {
      setSelectedArchs([selectedOptions]);
    } else {
      setSelectedArchs([]);
    }
  }, []);

  // Get filtered and flattened data for the table
  const tableData = useMemo(() => {
    const filteredChannels = getFilteredChannels(props.channels, selectedArchs);
    return flattenChannels(filteredChannels);
  }, [props.channels, selectedArchs, flattenChannels, getFilteredChannels]);

  // Column definitions
  const renderSyncCheckbox = (row: FlatChannelRow) => {
    const isSynced = syncedChannelIds.has(row.id);
    const isPendingAddition = props.channelsToAdd?.includes(row.id) || false;
    const isPendingRemoval = props.channelsToRemove?.includes(row.id) || false;
    const isChecked = (isSynced && !isPendingRemoval) || (!isSynced && isPendingAddition);

    return (
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          props.onChannelSelect(row.id, e.target.checked);
          const newSelectedIds = new Set(selectedChannelIds);
          if (e.target.checked) {
            newSelectedIds.add(row.id);
          } else {
            newSelectedIds.delete(row.id);
          }
          setSelectedChannelIds(newSelectedIds);
        }}
      />
    );
  };

  const renderChannelName = (row: FlatChannelRow) => {
    const isSynced = syncedChannelIds.has(row.id);

    if (row.isChild) {
      return (
        <span style={{ paddingLeft: "20px" }}>
          {row.name}
          {isSynced ? " ✓" : ""}
        </span>
      );
    }

    if (row.hasChildren) {
      const isOpen = openRows.has(row.id);
      return (
        <span
          style={{ cursor: "pointer" }}
          onClick={() => {
            const newOpenRows = new Set(openRows);
            if (isOpen) {
              newOpenRows.delete(row.id);
            } else {
              newOpenRows.add(row.id);
            }
            setOpenRows(newOpenRows);
          }}
        >
          <i className={`fa ${isOpen ? "fa-angle-down" : "fa-angle-right"}`} /> {row.name}
          {isSynced ? " ✓" : ""}
        </span>
      );
    }

    return (
      <span>
        {row.name}
        {isSynced ? " ✓" : ""}
      </span>
    );
  };

  const renderSyncOrg = (row: FlatChannelRow) => {
    const syncData = channelProcessor.getSyncData(row.id);
    const isPendingAddition = props.channelsToAdd?.includes(row.id) || false;
    const isPendingRemoval = props.channelsToRemove?.includes(row.id) || false;
    const isChecked = (row.synced && !isPendingRemoval) || (!row.synced && isPendingAddition);

    if (!isChecked) {
      return <span>-</span>;
    }

    if (!syncData) {
      return <span className="text-warning">No sync data</span>;
    }

    if (syncData.channelOrg === null) {
      return <span>Vendor</span>;
    }

    return (
      <select
        className="form-control input-sm"
        value={syncData.selectedPeripheralOrg?.orgId.toString() || ""}
        onChange={(e) => {
          const orgId = e.target.value;
          props.onOrgSelect(row.id, orgId ? props.availableOrgs.find((org) => org.orgId === Number(orgId)) : undefined);
        }}
        disabled={syncData.strictOrg}
      >
        <option value="">{t("Select Organization")}</option>
        {props.availableOrgs.map((org) => (
          <option key={org.orgId} value={org.orgId.toString()}>
            {org.orgName}
          </option>
        ))}
      </select>
    );
  };

  // Search filter function
  const searchFilter = (row: FlatChannelRow, criteria: string | undefined) => {
    if (!criteria) return true;
    const searchLower = criteria.toLowerCase();
    return row.name.toLowerCase().includes(searchLower) || row.label.toLowerCase().includes(searchLower);
  };

  // Row CSS class function
  const rowClass = (row: FlatChannelRow) => {
    const classes: string[] = [];
    if (row.synced) classes.push("synced-channel");
    if (row.isChild) classes.push("child-channel-row");
    else classes.push("base-channel-row");
    return classes.join(" ");
  };

  if (props.loading) {
    return (
      <div className="text-center">
        <i className="fa fa-spinner fa-spin fa-2x"></i>
        <p>{t("Loading channels...")}</p>
      </div>
    );
  }

  return (
    <div className="sync-channels-wrapper">
      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-12">
          <select
            className="form-control"
            multiple
            value={selectedArchs}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (option) => option.value);
              setSelectedArchs(selected);
            }}
          >
            <option value="" disabled>
              {t("Filter by architecture")}
            </option>
            {getDistinctArchs(props.channels).map((arch) => (
              <option key={arch.value} value={arch.value}>
                {arch.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="row mb-2">
        <div className="col-md-12">
          <p className="text-muted">
            {t("Total channels: {total} | Selected: {selected} | Synced: {synced}", {
              total: props.channels.reduce((acc, ch) => acc + 1 + ch.children.length, 0),
              selected: selectedChannelIds.size,
              synced: syncedChannelIds.size,
            })}
          </p>
        </div>
      </div>

      {/* Table */}
      <Table
        data={tableData}
        identifier={(row: FlatChannelRow) => row.id}
        searchField={
          <SearchField
            filter={searchFilter}
            placeholder={t("Search channels...")}
            criteria={searchValue}
            onSearch={(value) => setSearchValue(value || "")}
          />
        }
        initialItemsPerPage={50}
        cssClassFunction={rowClass}
      >
        <Column
          columnKey="sync"
          header={t("Sync")}
          cell={renderSyncCheckbox}
          width="60px"
          headerClass="text-center"
          columnClass="text-center"
        />
        <Column columnKey="channelName" header={t("Channel Name")} cell={renderChannelName} />
        <Column
          columnKey="channelArch"
          header={t("Architecture")}
          cell={(row: FlatChannelRow) => row.archLabel}
          width="150px"
        />
        <Column columnKey="syncOrg" header={t("Sync Org")} cell={renderSyncOrg} width="250px" />
      </Table>
    </div>
  );
};

export default SyncChannelsSelection;
