// SyncChannelsSelection.tsx
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import debounce from "lodash/debounce";

import { BaseChannelType, ChannelTreeType, ChildChannelType } from "core/channels/type/channels.type";

import { Form, Select } from "components/input";
import { SearchField } from "components/table/SearchField";

import { Channel, Org } from "../types";
import SyncChannelProcessor from "./sync-channels-processor";

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
  const [allRows, setAllRows] = useState<ChannelTreeType[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<number>>(new Set());
  const [syncedChannelIds, setSyncedChannelIds] = useState<Set<number>>(new Set());
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchs, setSelectedArchs] = useState<string[]>([]);

  const convertToChannelTree = useCallback((channels: Channel[]): ChannelTreeType[] => {
    const channelMap = new Map<string, Channel>();
    channels.forEach((ch) => channelMap.set(ch.channelLabel, ch));
    const rootChannels = channels.filter((ch) => !ch.parentChannelLabel);

    return rootChannels.map((root) => {
      const base: BaseChannelType = {
        id: root.channelId,
        label: root.channelLabel,
        name: root.channelName,
        custom: root.channelOrg !== null,
        archLabel: root.channelArch,
        recommendedChildren: [],
        isCloned: false,
        standardizedName: root.channelName.toLowerCase(),
        recommended: false,
        subscribable: false,
      };

      const children: ChildChannelType[] = root.children.map((child) => ({
        id: child.channelId,
        label: child.channelLabel,
        name: child.channelName,
        custom: child.channelOrg !== null,
        archLabel: child.channelArch,
        recommendedChildren: [],
        isCloned: false,
        standardizedName: child.channelName.toLowerCase(),
        recommended: false,
        subscribable: false,
        parent: base,
      }));

      return { base, children };
    });
  }, []);

  const getDistinctArchs = useCallback((channels: Channel[]) => {
    const archSet = new Set<string>();
    channels.forEach((channel) => archSet.add(channel.channelArch));
    return Array.from(archSet).map((arch) => ({ value: arch, label: arch }));
  }, []);

  // Apply filters and search
  const filteredRows = useMemo(() => {
    let result = [...allRows];
    // Apply architecture filter
    if (selectedArchs.length > 0) {
      result = result
        .filter((row) => {
          const baseMatches = selectedArchs.includes(row.base.archLabel || "");
          const hasMatchingChild = row.children.some((child) => selectedArchs.includes(child.archLabel || ""));
          return baseMatches || hasMatchingChild;
        })
        .map((row) => {
          // If base matches, show all children
          if (selectedArchs.includes(row.base.archLabel || "")) {
            return row;
          }
          // Otherwise, filter children
          return {
            ...row,
            children: row.children.filter((child) => selectedArchs.includes(child.archLabel || "")),
          };
        });
    }
    // Apply text search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result
        .filter((row) => {
          const baseMatches =
            row.base.name.toLowerCase().includes(searchLower) || row.base.label.toLowerCase().includes(searchLower);
          const hasMatchingChild = row.children.some(
            (child) => child.name.toLowerCase().includes(searchLower) || child.label.toLowerCase().includes(searchLower)
          );
          return baseMatches || hasMatchingChild;
        })
        .map((row) => {
          // If base matches, show all children
          if (row.base.name.toLowerCase().includes(searchLower) || row.base.label.toLowerCase().includes(searchLower)) {
            return row;
          }
          // Otherwise, filter children
          return {
            ...row,
            children: row.children.filter(
              (child) =>
                child.name.toLowerCase().includes(searchLower) || child.label.toLowerCase().includes(searchLower)
            ),
          };
        });
    }

    return result;
  }, [allRows, selectedArchs, searchTerm]);

  useEffect(() => {
    const channelTree = convertToChannelTree(props.channels);
    channelProcessor.setAvailableOrgs(props.availableOrgs);

    const syncedIds = new Set<number>();
    const selectedIds = new Set<number>();

    props.channels.forEach((channel) => {
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
    });

    setSyncedChannelIds(syncedIds);
    setSelectedChannelIds(selectedIds);
    setAllRows(channelTree);

    // Open all rows initially for better UX
    setOpenRows(new Set(channelTree.map((row) => row.base.id)));
  }, [props.channels, props.availableOrgs, props.channelsToAdd, props.channelsToRemove, convertToChannelTree]);

  // debounce after 300ms so that it procs when user most likely has stopped typing
  const handleSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const handleArchFilterChange = useCallback((_: string | undefined, selectedOptions: string | string[]) => {
    if (Array.isArray(selectedOptions)) {
      setSelectedArchs(selectedOptions);
    } else if (typeof selectedOptions === "string") {
      setSelectedArchs([selectedOptions]);
    } else {
      setSelectedArchs([]);
    }
  }, []);

  const filterByChannelName = useCallback((datum: any, criteria: string | undefined) => {
    if (criteria) {
      return datum.channelName?.toLowerCase().includes(criteria.toLowerCase()) || false;
    }
    return true;
  }, []);

  // Render a channel row (base or child)
  const renderChannelRow = (channel: BaseChannelType | ChildChannelType, isChild: boolean = false) => {
    const channelId = channel.id;
    const isSelected = selectedChannelIds.has(channelId);
    const isSynced = syncedChannelIds.has(channelId);
    const syncData = channelProcessor.getSyncData(channelId);

    const isCurrentlySynced = isSynced;
    const isPendingAddition = props.channelsToAdd?.includes(channelId) || false;
    const isPendingRemoval = props.channelsToRemove?.includes(channelId) || false;
    const isChecked = (isCurrentlySynced && !isPendingRemoval) || (!isCurrentlySynced && isPendingAddition);

    const renderOrg = () => {
      return !isChecked ? (
        <span>-</span>
      ) : (
        <Form>
          <Select
            className="mb-0"
            name={`org-select-${channelId}`}
            placeholder={t("Select Organization")}
            options={props.availableOrgs}
            getOptionValue={(org: Org) => org.orgId.toString()}
            getOptionLabel={(org: Org) => org.orgName}
            defaultValue={syncData?.selectedPeripheralOrg?.orgId.toString()}
            onChange={(_: string | undefined, orgId: string) => {
              props.onOrgSelect(
                channelId,
                props.availableOrgs.find((org) => org.orgId === Number(orgId))
              );
            }}
            disabled={syncData?.strictOrg}
          />
        </Form>
      );
    };

    return (
      <tr
        key={channelId}
        className={`${isSynced ? "synced-channel" : ""} ${isChild ? "child-channel-row" : "base-channel-row"}`}
      >
        <td className="text-center">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              props.onChannelSelect(channelId, e.target.checked);
              // Update local state
              const newSelectedIds = new Set(selectedChannelIds);
              if (e.target.checked) {
                newSelectedIds.add(channelId);
              } else {
                newSelectedIds.delete(channelId);
              }
              setSelectedChannelIds(newSelectedIds);
            }}
          />
        </td>
        <td>
          <span style={{ paddingLeft: isChild ? "20px" : "0" }}>
            {channel.name}
            {isSynced ? " ✓" : ""}
          </span>
        </td>
        <td>{channel.archLabel}</td>
        <td>{syncData?.channelOrg === null ? <span>Vendor</span> : renderOrg()}</td>
      </tr>
    );
  };

  // Render a channel tree (base and children)
  const renderChannelTree = (channelTree: ChannelTreeType) => {
    const { base, children } = channelTree;
    const isOpen = openRows.has(base.id);

    return (
      <React.Fragment key={base.id}>
        <tr className="base-channel-row">
          <td className="text-center">{renderChannelRow(base, false).props.children[0]}</td>
          <td>
            <span
              className="channel-expand-toggle"
              onClick={() => {
                const newOpenRows = new Set(openRows);
                if (isOpen) {
                  newOpenRows.delete(base.id);
                } else {
                  newOpenRows.add(base.id);
                }
                setOpenRows(newOpenRows);
              }}
              style={{ cursor: "pointer" }}
            >
              <i className={`fa ${isOpen ? "fa-angle-down" : "fa-angle-right"}`} /> {base.name}
              {syncedChannelIds.has(base.id) ? " ✓" : ""}
            </span>
          </td>
          <td>{base.archLabel}</td>
          <td>{renderChannelRow(base, false).props.children[3]}</td>
        </tr>
        {isOpen && children.map((child) => renderChannelRow(child, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="sync-channels-wrapper">
      {/* Filters at the top */}
      <div className="row">
        <div className="col-md-6">
          <SearchField
            placeholder={t("Search channels...")}
            filter={filterByChannelName}
            onSearch={(value) => handleSearch(value || "")}
          />
        </div>
        <div className="col-md-6">
          <Form>
            <Select
              name="channel-arch-filter"
              placeholder={t("Filter by architecture")}
              options={getDistinctArchs(props.channels)}
              isMulti={true}
              defaultValue={selectedArchs}
              onChange={handleArchFilterChange}
            />
          </Form>
        </div>
      </div>

      {/* Summary */}
      <div className="row mt-2">
        <div className="col-md-12">
          <p className="text-muted">
            {t("Total channels: {total} | Visible: {visible} | Selected: {selected} | Synced: {synced}", {
              total: props.channels.length,
              visible: filteredRows.reduce((acc, row) => acc + 1 + row.children.length, 0),
              selected: selectedChannelIds.size,
              synced: syncedChannelIds.size,
            })}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="row mt-3">
        <div className="col-md-12">
          {props.loading ? (
            <div className="text-center">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p>{t("Loading channels...")}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: "60px" }}>
                      {t("Sync")}
                    </th>
                    <th>{t("Channel Name")}</th>
                    <th style={{ width: "150px" }}>{t("Architecture")}</th>
                    <th style={{ width: "250px" }}>{t("Sync Org")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center">
                        {t("No channels found matching the current filters.")}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((channelTree) => renderChannelTree(channelTree))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncChannelsSelection;
