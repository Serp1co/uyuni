/*
 * Copyright (c) 2009--2014 Red Hat, Inc.
 *
 * This software is licensed to you under the GNU General Public License,
 * version 2 (GPLv2). There is NO WARRANTY for this software, express or
 * implied, including the implied warranties of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. You should have received a copy of GPLv2
 * along with this software; if not, see
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.txt.
 *
 * Red Hat trademarks are not licensed under GPLv2. No permission is
 * granted to use or replicate Red Hat trademarks that are incorporated
 * in this software or its documentation.
 */
package com.redhat.rhn.domain.server;

import com.redhat.rhn.common.hibernate.HibernateFactory;
import com.redhat.rhn.domain.org.Org;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.hibernate.Session;
import org.hibernate.type.StandardBasicTypes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * VirtualInstanceFactory provides data access operations for virtual instances.
 *
 * @see VirtualInstance
 */
public class VirtualInstanceFactory extends HibernateFactory {

    private static VirtualInstanceFactory instance = new VirtualInstanceFactory();

    /**
     * Logger for this class
     */
    private static Logger log = LogManager.getLogger(VirtualInstanceFactory.class);

    private interface HibernateCallback {
        Object executeInSession(Session session);
    }

    @Override
    protected Logger getLogger() {
        return log;
    }

    private Object execute(HibernateCallback command) {
        return command.executeInSession(HibernateFactory.getSession());
    }

    /**
     * Get instance of this factory.
     * @return VirtualInstanceFactory instance
     */
    public static VirtualInstanceFactory getInstance() {
        return instance;
    }

    /**
     * Saves the virtual instance to the database. The save is cascading so that if the
     * virtual instance is a registered guest, then any changes to this virtual instance's
     * guest server will be persisted as well.
     *
     * @param virtualInstance The virtual instance to save
     */
    public void saveVirtualInstance(VirtualInstance virtualInstance) {
        saveObject(virtualInstance);
    }

    /**
     * Gets the virtual Instance for a given Sid and Org for a guest
     * @param id the system id of the guest
     * @param org the org to check against
     * @return the guest's virtual instance
     */
    public VirtualInstance lookupByGuestId(Org org, Long id) {
        Session session = HibernateFactory.getSession();

        return (VirtualInstance) session.getNamedQuery("VirtualInstance.lookupGuestBySidAndOrg")
                .setParameter("org", org)
                .setParameter("sid", id, StandardBasicTypes.LONG)
                .uniqueResult();

    }

    /**
     * Gets the virtual Instance for a given Sid for a guest
     * @param id the system id of the guest
     * @return the guest's virtual instance
     */
    @SuppressWarnings("unchecked")
    public VirtualInstance lookupByGuestId(Long id) {
        Session session = HibernateFactory.getSession();
        return (VirtualInstance) session.getNamedQuery("VirtualInstance.lookupGuestBySid")
                .setParameter("sid", id, StandardBasicTypes.LONG)
                .uniqueResult();
    }

    /**
     * Check if the given guest instance is outdated. (i.e. a newer instance
     * exists with the same UUID)
     *
     * @param guest Virtual instance to check.
     * @return True if outdated, false otherwise.
     */
    public boolean isOutdated(VirtualInstance guest) {
        Session session = HibernateFactory.getSession();
        VirtualInstance results = (VirtualInstance) session.getNamedQuery("VirtualInstance.isOutdatedVirtualInstance")
                .setParameter("guest", guest).uniqueResult();
        return results != null;
    }


    /**
     * Retrieves the virtual instance with the specified ID.
     *
     * @param id The primary key
     * @return The virtual instance with the specified ID or <code>null</code> if no match
     * is found.
     */
    public VirtualInstance lookupById(final Long id) {
        return (VirtualInstance)execute(session -> session.get(VirtualInstance.class, id));
    }

    /**
     * Deletes the virtual instance from the database.
     * If the virtual instance has an association to a guest system (i.e. it is
     * a registered guest), remove this association.
     * If the virtual instance has an association to a host system, remove this
     * association.
     *
     * @param virtualInstance The virtual instance to delete
     */
    public void deleteVirtualInstanceOnly(VirtualInstance virtualInstance) {
        log.debug("Deleting virtual instance without removing associated objects {}", virtualInstance);
        Server hostSystem = virtualInstance.getHostSystem();
        if (hostSystem != null) {
            hostSystem.removeGuest(virtualInstance);
        }
        Server guestSystem = virtualInstance.getGuestSystem();
        if (guestSystem != null) {
            guestSystem.setVirtualInstance(null);
        }
        removeObject(virtualInstance);
    }

    /**
     * Finds all registered guests, within a particular org, whose hosts do not have any
     * virtualization entitlements.
     *
     * @param org The org to search in
     *
     * @return A set of GuestAndNonVirtHostView objects
     *
     * @see GuestAndNonVirtHostView
     */
    @SuppressWarnings("unchecked")
    public Set<GuestAndNonVirtHostView> findGuestsWithNonVirtHostByOrg(Org org) {
        Session session = HibernateFactory.getSession();
        List<Object[]> results = session.getNamedQuery("VirtualInstance.findGuestsWithNonVirtHostByOrg")
                .setParameter("org_id", org.getId(), StandardBasicTypes.LONG)
                .list();

        return new HashSet<>(convertToView(results));
    }

    /**
     * transforms a result set of
     * guest.id as guest_id
     * guest.org_id as guest_org_id,
     * guest.name as guest_name,
     * host.org_id as host_org_id,
     * host.id as host_id,
     * host.name as host_name
     * @param result a list of Object array of  id,name, count
     * @return list of GuestAndNonVirtHostView objects
     */
    private static List<GuestAndNonVirtHostView> convertToView(List<Object[]> out) {
        List<GuestAndNonVirtHostView> ret = new ArrayList<>(out.size());
        /*
         guest.id as guest_id,
         guest.org_id as guest_org_id,
         guest.name as guest_name,
         host.org_id as host_org_id,
         host.id as host_id,
         host.name as host_name
         */
        for (Object[] row : out) {

            /*
             guest.id as guest_id,
             guest.org_id as guest_org_id,
             guest.name as guest_name,
             host.org_id as host_org_id,
             host.id as host_id,
             host.name as host_name
             */

            Number guestId = (Number) row[0];
            Number guestOrgId = (Number) row[1];
            String guestName = (String) row[2];

            Number hostId = (Number) row[3];
            Number hostOrgId = (Number) row[4];
            String hostName = (String) row[5];

            GuestAndNonVirtHostView view = new GuestAndNonVirtHostView(
                    guestId.longValue(),
                    guestOrgId.longValue(),
                    guestName,
                    hostId.longValue(),
                    hostOrgId.longValue(),
                    hostName);
            ret.add(view);
        }
        return ret;
    }


    /**
     * Finds all registered guests, within a particular org, who do not have a registered
     * host.
     *
     * @param org The org to search in
     *
     * @return set A set of GuestAndNonVirtHostView objects
     *
     * @see GuestAndNonVirtHostView
     */
    @SuppressWarnings("unchecked")
    public Set<GuestAndNonVirtHostView> findGuestsWithoutAHostByOrg(Org org) {
        Session session = HibernateFactory.getSession();

        List<GuestAndNonVirtHostView> results = session.getNamedQuery("VirtualInstance.findGuestsWithoutAHostByOrg")
                .setParameter("org", org)
                .list();

        return new HashSet<>(results);
    }

    /**
     * Returns the para-virt type.
     *
     * @return  The para-virt type
     */
    public VirtualInstanceType getParaVirtType() {
        return (VirtualInstanceType)getSession().getNamedQuery("VirtualInstanceType.findByLabel")
                .setParameter("label", "para_virtualized", StandardBasicTypes.STRING)
                .setCacheable(true).uniqueResult();
    }

    /**
     * Returns the fully-virt type.
     *
     * @return The fully-virt type.
     */
    public VirtualInstanceType getFullyVirtType() {
        return (VirtualInstanceType)getSession().getNamedQuery("VirtualInstanceType.findByLabel")
                .setParameter("label", "fully_virtualized", StandardBasicTypes.STRING)
                .setCacheable(true).uniqueResult();
    }

    /**
     * Returns the requested virtual instance type.
     *
     * @param label the type label
     * @return The type or null
     */
    public VirtualInstanceType getVirtualInstanceType(String label) {
        return (VirtualInstanceType)getSession().getNamedQuery("VirtualInstanceType.findByLabel")
                .setParameter("label", label, StandardBasicTypes.STRING)
                .setCacheable(true).uniqueResult();
    }

    /**
     * Returns the running state.
     *
     * @return The running state
     */
    public VirtualInstanceState getRunningState() {
        return (VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", "running", StandardBasicTypes.STRING)
                .uniqueResult();
    }

    /**
     * Returns the stopped state.
     *
     * @return The stopped state
     */
    public VirtualInstanceState getStoppedState() {
        return (VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", "stopped", StandardBasicTypes.STRING)
                .uniqueResult();
    }

    /**
     * Returns the paused state.
     *
     * @return The paused state
     */
    public VirtualInstanceState getPausedState() {
        return (VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", "paused", StandardBasicTypes.STRING)
                .uniqueResult();
    }

    /**
     * Return the crashed state.
     *
     * @return The crashed state
     */
    public VirtualInstanceState getCrashedState() {
        return (VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", "crashed", StandardBasicTypes.STRING)
                .uniqueResult();
    }

    /**
     * Return the unknown state
     *
     *  @return The unknown state
     */
    public VirtualInstanceState getUnknownState() {
        return (VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", "unknown", StandardBasicTypes.STRING)
                .uniqueResult();
    }

    /**
     * Returns state of the given label
     *
     * @param label state label
     * @return virtualInstanceState found by label or null
     */
    public Optional<VirtualInstanceState> getState(String label) {
        return Optional.ofNullable((VirtualInstanceState)getSession().getNamedQuery("VirtualInstanceState.findByLabel")
                .setParameter("label", label, StandardBasicTypes.STRING)
                .uniqueResult());
    }

    /**
     * Returns a VirtualInstance with given uuid
     * @param uuid - uuid of the vm
     * @return VirtualInstance with given uuid
     */
    public List<VirtualInstance> lookupVirtualInstanceByUuid(String uuid) {
        return getSession()
                .getNamedQuery("VirtualInstance.lookupVirtualInstanceByUuid")
                .setParameter("uuid", uuid, StandardBasicTypes.STRING)
                .list();
    }

    /**
     * Returns a VirtualInstance that is linked to the host system with given id.
     * @param hostId - id of the host system
     * @return VirtualInstance linked to the host with given id
     */
    public VirtualInstance lookupHostVirtInstanceByHostId(Long hostId) {
        return (VirtualInstance) getSession()
                .getNamedQuery("VirtualInstance.lookupHostVirtInstanceByHostId")
                .setParameter("hostId", hostId, StandardBasicTypes.LONG)
            .uniqueResult();
    }

    /**
     * Returns a VirtualInstance with given uuid and host id.
     * @param hostId - id of the host system
     * @param uuid - uuid of the guest
     * @return VirtualInstance with uuid running on host matching hostId
     */
    public VirtualInstance lookupVirtualInstanceByHostIdAndUuid(Long hostId, String uuid) {
        return (VirtualInstance) getSession()
                .getNamedQuery("VirtualInstance.lookupHostVirtInstanceByHostIdAndUuid")
                .setParameter("hostId", hostId, StandardBasicTypes.LONG)
                .setParameter("uuid", uuid, StandardBasicTypes.STRING)
            .uniqueResult();
    }
}
